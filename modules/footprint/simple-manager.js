// modules/footprint/simple-manager.js
// 🔥 ВЕКТОРНАЯ СИСТЕМА С АККУМУЛЯТИВНЫМ ПОДТВЕРЖДЕНИЕМ
// 🔥 ДОБАВЛЕНЫ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ С ОСНОВНЫМ БОТОМ

const fs = require('fs');
const path = require('path');

// 🔥 ВЕКТОРНЫЙ АЛГОРИТМ
let VectorAlgorithm;
try {
    VectorAlgorithm = require('./clean/vector-algorithm');
    console.log('✅ Геометрический алгоритм загружен');
} catch (error) {
    console.log(`⚠️ Не удалось загрузить векторный алгоритм: ${error.message}`);
    // Фаллбэк
    VectorAlgorithm = require('./fallback-algorithm');
}

class SimpleFootprintManager {
    constructor(options = {}) {
        console.log('🚀 SimpleFootprintManager создан (ВЕКТОРНАЯ система с аккумулятивным подтверждением)');

        // 🔥 НАСТРОЙКИ
        const {
            dbPath = './data/footprints',
            autoSave = true,
            debug = false,
            useAccumulativeModel = true, // 🔥 АККУМУЛЯТИВНАЯ МОДЕЛЬ
            similarityThreshold = 0.6, // 60% для "same"
            minPointsForFootprint = 5,
            ...otherOptions
        } = options;

        this.config = {
            dbPath,
            autoSave,
            debug,
            useAccumulativeModel,
            similarityThreshold,
            minPointsForFootprint,
            ...otherOptions
        };

        // 🔥 ВЕКТОРНЫЙ АЛГОРИТМ (ОСНОВНОЙ)
        this.vectorAlgorithm = new VectorAlgorithm({
            minSimilarity: this.config.similarityThreshold,
            debug: this.config.debug
        });

        console.log('✅ Векторный алгоритм инициализирован');

        // 🔥 АККУМУЛЯТИВНАЯ МОДЕЛЬ (ГЛАВНОЕ ХРАНИЛИЩЕ)
        this.accumulativeModels = new Map(); // userId -> AccumulativeModel

        // 🔥 ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
        this.userSessions = new Map(); // userId -> session
        this.loadedModels = new Map();

        // СТАТИСТИКА
        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalPhotosProcessed: 0,
            algorithm: 'vector_accumulative_v1.0'
        };

        this.ensureDirectories();
        this.loadExistingModels();

        console.log('✅ SimpleFootprintManager готов (аккумулятивная модель)');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Добавление фото
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО пользователю ${userId} (ВЕКТОРНАЯ)`);

        try {
            if (!analysis?.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }

            // Извлечение ВЕКТОРНЫХ точек
            const points = this.extractPointsFromAnalysis(analysis);
            if (points.length < this.config.minPointsForFootprint) {
                return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
            }

            console.log(`📊 Извлечено ${points.length} векторных точек`);

            // Получаем или создаем аккумулятивную модель
            let accumulativeModel = this.accumulativeModels.get(userId);
            if (!accumulativeModel) {
                accumulativeModel = new AccumulativeModel(userId);
                this.accumulativeModels.set(userId, accumulativeModel);
                console.log(`🆕 Создана новая аккумулятивная модель для ${userId}`);
            }

            // 🔥 ОБРАБОТКА В АККУМУЛЯТИВНОЙ МОДЕЛИ
            const result = await accumulativeModel.processNewFootprint(
                points,
                photoInfo,
                this.vectorAlgorithm
            );

            // 🔥 ДЛЯ СОВМЕСТИМОСТИ: создаем сессию
            let session = this.userSessions.get(userId);
            if (!session) {
                session = {
                    id: `${userId}_${Date.now()}`,
                    userId: userId,
                    photos: [],
                    footprints: [],
                    currentFootprint: null,
                    lastActivity: new Date(),
                    metadata: {}
                };
                this.userSessions.set(userId, session);
            }
           
            // Обновляем сессию
            session.lastActivity = new Date();
            session.photos.push({
                id: `photo_${Date.now()}`,
                timestamp: new Date(),
                pointsCount: points.length,
                photoInfo: photoInfo
            });
           
            // Для совместимости создаем упрощенный отпечаток
            const SimpleFootprint = require('./simple-footprint');
            const tempFootprint = new SimpleFootprint({
                userId: userId,
                name: `Temp_${Date.now()}`
            });
           
            tempFootprint.addAnalysis(analysis, photoInfo);
            session.currentFootprint = tempFootprint;

            // Обновляем статистику
            this.systemStats.totalPhotosProcessed++;
            this.systemStats.totalUsers = this.accumulativeModels.size;

            // 🔥 СОЗДАЕМ ВИЗУАЛИЗАЦИЮ
            let visualizationResult = null;
            if (bot && chatId) {
                visualizationResult = await this.createAndSendVisualization(
                    accumulativeModel,
                    result,
                    bot,
                    chatId
                );
            }

            return {
                success: true,
                ...result,
                visualization: visualizationResult,
                accumulativeModelId: accumulativeModel.id,
                totalPointsInModel: accumulativeModel.getAllPoints().length,
                sessionId: session.id, // 🔥 ДОБАВИЛИ ДЛЯ СОВМЕСТИМОСТИ
                totalNodes: tempFootprint.graph.nodes.size // 🔥 ДЛЯ СОВМЕСТИМОСТИ
            };

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    // 🔥 МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ С ОСНОВНЫМ БОТОМ
    getActiveSession(userId) {
        return this.userSessions.get(userId) || null;
    }
   
    getSessionInfo(userId) {
        const session = this.userSessions.get(userId);
        if (!session) return null;
       
        return {
            id: session.id,
            userId: session.userId,
            photos: session.photos.length,
            lastActivity: session.lastActivity,
            currentFootprint: session.currentFootprint ? {
                id: session.currentFootprint.id,
                name: session.currentFootprint.name,
                nodeCount: session.currentFootprint.graph?.nodes?.size || 0
            } : null
        };
    }
   
    hasSession(userId) {
        return this.userSessions.has(userId);
    }
   
    createSession(userId, name = null) {
        const session = {
            id: `${userId}_${Date.now()}`,
            userId: userId,
            name: name || `Сессия_${new Date().toLocaleTimeString('ru-RU')}`,
            photos: [],
            footprints: [],
            currentFootprint: null,
            lastActivity: new Date(),
            metadata: {}
        };
       
        this.userSessions.set(userId, session);
        return session;
    }
   
    updateLastActivity(userId) {
        const session = this.userSessions.get(userId);
        if (session) {
            session.lastActivity = new Date();
            return true;
        }
        return false;
    }

    // 🔥 ИЗВЛЕЧЕНИЕ ВЕКТОРНЫХ ТОЧЕК
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
                    class: pred.class
                });
            }
        }

        return points.filter(p =>
            p && typeof p.x === 'number' && typeof p.y === 'number' &&
            !isNaN(p.x) && !isNaN(p.y)
        );
    }

    // 🔥 СОЗДАНИЕ И ОТПРАВКА ВИЗУАЛИЗАЦИИ
    async createAndSendVisualization(accumulativeModel, result, bot, chatId) {
        try {
            // Создаем визуализатор
            const ClusterVisualizer = require('./visualizations/cluster-visualizer');
            const visualizer = new ClusterVisualizer({
                outputDir: './data/footprints/visualizations'
            });

            // Получаем данные для визуализации
            const visualizationData = accumulativeModel.getVisualizationData();

            // Создаем визуализацию
            const vizResult = await visualizer.visualizeAccumulativeModel(
                visualizationData,
                {
                    filename: `accumulative_${accumulativeModel.id}_${Date.now()}.png`,
                    title: `Аккумулятивная модель (${accumulativeModel.footprints.length} следов)`
                }
            );

            // Отправляем в Telegram
            if (vizResult && vizResult.path && fs.existsSync(vizResult.path)) {
                const caption = this.createTelegramCaption(result, accumulativeModel);
               
                await bot.sendPhoto(chatId, vizResult.path, {
                    caption: this.cleanMarkdown(caption),
                    parse_mode: 'HTML'
                });

                console.log('✅ Визуализация отправлена в Telegram');
                return vizResult;
            }

        } catch (error) {
            console.log(`⚠️ Ошибка создания визуализации: ${error.message}`);
        }
       
        return null;
    }

    createTelegramCaption(result, accumulativeModel) {
        let caption = `🎯 РЕЗУЛЬТАТ СРАВНЕНИЯ\n\n`;
       
        if (result.isFirstFootprint) {
            caption += `👣 ПЕРВЫЙ СЛЕД СОЗДАН\n`;
            caption += `📊 Извлечено: ${result.pointsAdded} точек\n`;
            caption += `🆔 ID модели: ${accumulativeModel.id.slice(0, 8)}\n\n`;
            caption += `✅ Теперь можно добавлять другие фото этой же обуви`;
        } else {
            caption += `🔍 СРАВНЕНИЕ С СУЩЕСТВУЮЩИМ СЛЕДОМ\n`;
            caption += `📊 Сходство: ${(result.similarity * 100).toFixed(1)}%\n`;
            caption += `🎯 Решение: ${result.decision === 'same' ? '✅ ОДНА обувь' : '🆕 НОВАЯ обувь'}\n\n`;
           
            if (result.decision === 'same') {
                caption += `📈 Статистика подтверждений:\n`;
                caption += `• 🔴 3+ подтверждений: ${accumulativeModel.getConfirmedCount(3)}\n`;
                caption += `• 🟠 2 подтверждения: ${accumulativeModel.getConfirmedCount(2)}\n`;
                caption += `• 🔵 1 подтверждение: ${accumulativeModel.getConfirmedCount(1)}\n`;
                caption += `\nВсего точек в модели: ${accumulativeModel.getAllPoints().length}`;
            }
        }
       
        return caption;
    }

    cleanMarkdown(text) {
        return text
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/__/g, '')
            .replace(/_/g, '')
            .replace(/`/g, '')
            .replace(/\[/g, '(')
            .replace(/\]/g, ')');
    }

    // 🔥 ПОЛУЧИТЬ СТАТИСТИКУ
    getSystemStats() {
        const modelStats = [];
       
        for (const [userId, model] of this.accumulativeModels) {
            modelStats.push({
                userId,
                footprints: model.footprints.length,
                totalPoints: model.getAllPoints().length,
                confirmed3: model.getConfirmedCount(3),
                confirmed2: model.getConfirmedCount(2),
                confirmed1: model.getConfirmedCount(1)
            });
        }

        return {
            ...this.systemStats,
            activeModels: this.accumulativeModels.size,
            activeSessions: this.userSessions.size, // 🔥 ДЛЯ СОВМЕСТИМОСТИ
            modelStats: modelStats,
            algorithm: 'Векторная аккумулятивная система'
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'models'),
            path.join(this.config.dbPath, 'visualizations')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    loadExistingModels() {
        const modelsDir = path.join(this.config.dbPath, 'models');
        if (!fs.existsSync(modelsDir)) return;

        const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.json'));
        let loadedCount = 0;

        files.forEach(file => {
            try {
                const filePath = path.join(modelsDir, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
               
                const model = AccumulativeModel.fromJSON(data);
                this.accumulativeModels.set(model.userId, model);
                loadedCount++;
               
            } catch (error) {
                console.log(`⚠️ Ошибка загрузки модели ${file}:`, error.message);
            }
        });

        console.log(`📂 Загружено ${loadedCount} аккумулятивных моделей`);
    }

    saveModel(userId) {
        try {
            const model = this.accumulativeModels.get(userId);
            if (!model) return { success: false, error: 'Модель не найдена' };

            const modelsDir = path.join(this.config.dbPath, 'models');
            if (!fs.existsSync(modelsDir)) {
                fs.mkdirSync(modelsDir, { recursive: true });
            }

            const filename = `accumulative_model_${userId}_${Date.now()}.json`;
            const filePath = path.join(modelsDir, filename);

            fs.writeFileSync(filePath, JSON.stringify(model.toJSON(), null, 2));

            console.log(`💾 Модель сохранена: ${filename}`);
            return { success: true, filePath };

        } catch (error) {
            console.error(`❌ Ошибка сохранения модели: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

// 🔥 КЛАСС АККУМУЛЯТИВНОЙ МОДЕЛИ
class AccumulativeModel {
    constructor(userId) {
        this.id = `accum_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.userId = userId;
        this.createdAt = new Date();
       
        // 🔥 ОСНОВНОЕ ХРАНИЛИЩЕ: все точки из всех следов
        this.allPoints = new Map(); // pointId -> { data, seenInFootprints, confirmationCount }
       
        // Список следов (фото)
        this.footprints = []; // { id, points, timestamp, vectorHashes }
       
        // Счетчик для ID точек
        this.nextPointId = 1;
       
        console.log(`🆕 Создана аккумулятивная модель ${this.id} для пользователя ${userId}`);
    }

    // 🔥 ОБРАБОТКА НОВОГО СЛЕДА
    async processNewFootprint(points, photoInfo, vectorAlgorithm) {
        console.log(`\n🔄 Обработка нового следа (${points.length} точек)`);

        // Создаем векторный отпечаток
        const vectorFootprint = vectorAlgorithm.createFootprint(points, `footprint_${Date.now()}`);
       
        const footprintData = {
            id: `fp_${Date.now()}`,
            originalPoints: points,
            vectorFootprint: vectorFootprint,
            timestamp: new Date(),
            photoInfo: photoInfo
        };

        // Если это первый след
        if (this.footprints.length === 0) {
            return this.handleFirstFootprint(footprintData);
        }
       
        // Сравниваем с существующими следами
        return this.handleSubsequentFootprint(footprintData, vectorAlgorithm);
    }

    // 🔥 ПЕРВЫЙ СЛЕД
    handleFirstFootprint(footprintData) {
        console.log(`👣 Первый след, добавляю все точки`);
       
        // Добавляем все точки как неподтвержденные (confirmationCount = 1)
        footprintData.vectorFootprint.forEach(point => {
            const pointId = `pt_${this.nextPointId++}`;
           
            this.allPoints.set(pointId, {
                id: pointId,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                seenInFootprints: new Set([footprintData.id]),
                confirmationCount: 1,
                firstSeen: new Date(),
                lastSeen: new Date(),
                vectorId: point.vectorId,
                color: 'blue' // 🔵 Первый след - синий
            });
        });

        // Сохраняем след
        this.footprints.push(footprintData);

        return {
            isFirstFootprint: true,
            pointsAdded: footprintData.vectorFootprint.length,
            totalPoints: this.allPoints.size,
            decision: 'new'
        };
    }

    // 🔥 ПОСЛЕДУЮЩИЙ СЛЕД
    handleSubsequentFootprint(footprintData, vectorAlgorithm) {
        console.log(`🔍 Сравниваю с ${this.footprints.length} существующими следами`);
       
        let bestSimilarity = 0;
        let bestMatches = [];
       
        // Сравниваем со всеми существующими следами
        for (const existingFootprint of this.footprints) {
            const comparison = vectorAlgorithm.compareFootprints(
                existingFootprint.vectorFootprint,
                footprintData.vectorFootprint,
                'Существующий',
                'Новый'
            );
           
            if (comparison.similarity > bestSimilarity) {
                bestSimilarity = comparison.similarity;
                bestMatches = comparison.matches || [];
            }
        }
       
        console.log(`📊 Лучшее сходство: ${bestSimilarity.toFixed(3)}`);
       
        // Принимаем решение
        const isSame = bestSimilarity >= 0.6; // 60% порог
       
        if (isSame) {
            return this.mergeFootprint(footprintData, bestMatches, bestSimilarity);
        } else {
            return this.addAsNewFootprint(footprintData);
        }
    }

    // 🔥 ОБЪЕДИНЕНИЕ С СУЩЕСТВУЮЩИМ СЛЕДОМ
mergeFootprint(footprintData, matches, similarity) {
    console.log(`✅ Следы совпали (${(similarity * 100).toFixed(1)}%), объединяю...`);
   
    // 🔥 ИСПРАВЛЕНИЕ: Берем только реальные совпадения
    const realMatches = matches.filter(m => m.similarity > 0.8);
   
    console.log(`📊 Реальных совпадений: ${realMatches.length}/${matches.length}`);
   
    // 1. Собираем все vectorId из нового следа
    const newPointMap = new Map(); // vectorId -> point
    footprintData.vectorFootprint.forEach(point => {
        if (point.vectorId) {
            newPointMap.set(point.vectorId, point);
        }
    });
   
    // 2. Обновляем подтверждения для совпавших точек
    let confirmedCount = 0;
   
    realMatches.forEach(match => {
        if (match.point1?.vectorId) {
            // Ищем точку в allPoints по vectorId
            for (const [pointId, pointData] of this.allPoints) {
                if (pointData.vectorId === match.point1.vectorId) {
                    // Увеличиваем счетчик подтверждений
                    pointData.seenInFootprints.add(footprintData.id);
                    pointData.confirmationCount = pointData.seenInFootprints.size;
                    pointData.lastSeen = new Date();
                   
                    // Обновляем цвет
                    if (pointData.confirmationCount >= 3) {
                        pointData.color = 'red'; // 🔴
                    } else if (pointData.confirmationCount === 2) {
                        pointData.color = 'orange'; // 🟠
                    }
                   
                    confirmedCount++;
                    newPointMap.delete(pointData.vectorId); // Убираем из новых
                    break;
                }
            }
        }
    });
   
    // 3. Добавляем НОВЫЕ точки (которые не совпали)
    let newPointsAdded = 0;
   
    for (const [vectorId, point] of newPointMap) {
        // Это новая точка (не было в предыдущих следах)
        const pointId = `pt_${this.nextPointId++}`;
       
        this.allPoints.set(pointId, {
            id: pointId,
            x: point.x,
            y: point.y,
            confidence: point.confidence || 0.5,
            seenInFootprints: new Set([footprintData.id]),
            confirmationCount: 1,
            firstSeen: new Date(),
            lastSeen: new Date(),
            vectorId: point.vectorId,
            color: 'blue' // 🔵 Новые точки - синие
        });
       
        newPointsAdded++;
    }
   
    // Сохраняем след
    this.footprints.push(footprintData);
   
    // Статистика по подтверждениям
    let confirmed1 = 0, confirmed2 = 0, confirmed3 = 0;
    for (const pointData of this.allPoints.values()) {
        if (pointData.confirmationCount >= 3) confirmed3++;
        else if (pointData.confirmationCount === 2) confirmed2++;
        else confirmed1++;
    }
   
    console.log(`📈 Результат объединения:`);
    console.log(`   • Подтверждено существующих точек: ${confirmedCount}`);
    console.log(`   • Добавлено новых точек: ${newPointsAdded}`);
    console.log(`   • Всего уникальных точек в модели: ${this.allPoints.size}`);
    console.log(`   • 🔴 3+ подтверждений: ${confirmed3}`);
    console.log(`   • 🟠 2 подтверждения: ${confirmed2}`);
    console.log(`   • 🔵 1 подтверждение: ${confirmed1}`);
   
    return {
        isFirstFootprint: false,
        similarity: similarity,
        decision: 'same',
        pointsConfirmed: confirmedCount,
        pointsAdded: newPointsAdded,
        totalPoints: this.allPoints.size,
        stats: {
            confirmed3: confirmed3,
            confirmed2: confirmed2,
            confirmed1: confirmed1
        }
    };
}

    // 🔥 НОВЫЙ СЛЕД (другая обувь)
    addAsNewFootprint(footprintData) {
        console.log(`🆕 Новая обувь, добавляю как отдельный след`);
       
        // В аккумулятивной модели все следы одной обуви,
        // но для разных обувей нужно создавать новые модели
        // Пока просто добавляем точки с confirmationCount = 1
       
        let pointsAdded = 0;
       
        footprintData.vectorFootprint.forEach(point => {
            const pointId = `pt_${this.nextPointId++}`;
           
            this.allPoints.set(pointId, {
                id: pointId,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                seenInFootprints: new Set([footprintData.id]),
                confirmationCount: 1,
                firstSeen: new Date(),
                lastSeen: new Date(),
                vectorId: point.vectorId,
                color: 'blue' // 🔵 Новые точки - синие
            });
           
            pointsAdded++;
        });
       
        // Сохраняем след
        this.footprints.push(footprintData);
       
        return {
            isFirstFootprint: false,
            similarity: 0,
            decision: 'different',
            pointsAdded: pointsAdded,
            totalPoints: this.allPoints.size,
            note: 'Новая обувь добавлена в ту же модель (в будущем разделять по обувям)'
        };
    }

    // 🔥 ПОЛУЧИТЬ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
    getVisualizationData() {
        const points = [];
        const confirmed3 = [];
        const confirmed2 = [];
        const confirmed1 = [];
       
        // Собираем все точки
        for (const pointData of this.allPoints.values()) {
            const point = {
                id: pointData.id,
                x: pointData.x,
                y: pointData.y,
                confidence: pointData.confidence,
                confirmations: pointData.confirmationCount,
                color: pointData.color,
                vectorId: pointData.vectorId
            };
           
            points.push(point);
           
            // Группируем по подтверждениям для статистики
            if (pointData.confirmationCount >= 3) {
                confirmed3.push(point);
            } else if (pointData.confirmationCount === 2) {
                confirmed2.push(point);
            } else {
                confirmed1.push(point);
            }
        }
       
        return {
            modelId: this.id,
            userId: this.userId,
            totalPoints: points.length,
            totalFootprints: this.footprints.length,
            points: points,
            confirmed3: confirmed3,
            confirmed2: confirmed2,
            confirmed1: confirmed1,
            stats: {
                confirmed3: confirmed3.length,
                confirmed2: confirmed2.length,
                confirmed1: confirmed1.length,
                avgConfirmations: points.length > 0 ?
                    points.reduce((sum, p) => sum + p.confirmations, 0) / points.length : 0
            },
            createdAt: this.createdAt
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    getAllPoints() {
        return Array.from(this.allPoints.values());
    }

    getConfirmedCount(minConfirmations) {
        let count = 0;
       
        for (const pointData of this.allPoints.values()) {
            if (pointData.confirmationCount >= minConfirmations) {
                count++;
            }
        }
       
        return count;
    }

    // 🔥 СЕРИАЛИЗАЦИЯ
    toJSON() {
        const serializedPoints = [];
       
        for (const [pointId, pointData] of this.allPoints) {
            serializedPoints.push([
                pointId,
                {
                    ...pointData,
                    seenInFootprints: Array.from(pointData.seenInFootprints),
                    firstSeen: pointData.firstSeen.toISOString(),
                    lastSeen: pointData.lastSeen.toISOString()
                }
            ]);
        }
       
        return {
            id: this.id,
            userId: this.userId,
            createdAt: this.createdAt.toISOString(),
            allPoints: serializedPoints,
            footprints: this.footprints.map(fp => ({
                ...fp,
                timestamp: fp.timestamp.toISOString(),
                // Не сериализуем originalPoints полностью
                vectorFootprint: fp.vectorFootprint.map(p => ({
                    x: p.x,
                    y: p.y,
                    vectorId: p.vectorId,
                    confidence: p.confidence
                }))
            })),
            nextPointId: this.nextPointId,
            _version: 'accumulative_v1.0'
        };
    }

    static fromJSON(data) {
        const model = new AccumulativeModel(data.userId);
        model.id = data.id || model.id;
        model.createdAt = new Date(data.createdAt);
        model.nextPointId = data.nextPointId || 1;
       
        // Восстанавливаем точки
        if (data.allPoints && Array.isArray(data.allPoints)) {
            data.allPoints.forEach(([pointId, pointData]) => {
                pointData.seenInFootprints = new Set(pointData.seenInFootprints || []);
                pointData.firstSeen = new Date(pointData.firstSeen);
                pointData.lastSeen = new Date(pointData.lastSeen);
                model.allPoints.set(pointId, pointData);
            });
        }
       
        // Восстанавливаем следы
        if (data.footprints && Array.isArray(data.footprints)) {
            model.footprints = data.footprints.map(fp => ({
                ...fp,
                timestamp: new Date(fp.timestamp)
            }));
        }
       
        console.log(`📂 Загружена аккумулятивная модель ${model.id} с ${model.allPoints.size} точками`);
        return model;
    }
}

module.exports = SimpleFootprintManager;
