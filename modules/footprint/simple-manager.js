// modules/footprint/simple-manager.js
// УПРОЩЕННЫЙ МЕНЕДЖЕР ЦИФРОВЫХ ОТПЕЧАТКОВ С АВТОСОВМЕЩЕНИЕМ И POINT TRACKER

const fs = require('fs');
const path = require('path');
const SimpleFootprint = require('./simple-footprint');
const SimpleMatcher = require('./simple-matcher');
const MergeVisualizer = require('./merge-visualizer');
const VectorSuperModel = require('./vector-super-model');
const crypto = require('crypto');
const { createCanvas } = require('canvas');

class SimpleFootprintManager {
    constructor(options = {}) {
        this.config = {
            dbPath: options.dbPath || './data/footprints',
            autoAlignment: options.autoAlignment !== false,
            autoSave: options.autoSave !== false,
            debug: options.debug || false,

            // 🔥 ВАЖНЫЕ НАСТРОЙКИ ДЛЯ ПОДТВЕРЖДЕНИЙ
            usePointTracker: true, // Всегда использовать PointTracker
            enableMergeVisualization: options.enableMergeVisualization !== false,
            enableIntelligentMerge: options.enableIntelligentMerge !== false,
            enableTopologySuperModel: options.enableTopologySuperModel !== false,

            // Пороги
            topologySimilarityThreshold: options.topologySimilarityThreshold || 0.7,
            highConfidenceThreshold: options.highConfidenceThreshold || 0.8,
            minPointsForFootprint: options.minPointsForFootprint || 5,

            // Настройки PointTracker
            trackerConfirmationThreshold: 2, // Минимум 2 подтверждения для высокой уверенности
            ...options
        };

        // Сессии пользователей: userId -> session
        this.userSessions = new Map();

        // Загруженные модели: modelId -> SimpleFootprint
        this.loadedModels = new Map();

        // Визуализатор объединений
        this.mergeVisualizer = new MergeVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations'),
            debug: this.config.debug
        });

        // Матчер для сравнения графов
        this.matcher = new SimpleMatcher({
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold
        });

        // История последних визуализаций объединения: userId -> [{path, timestamp, similarity}]
        this.lastMergeVisualizations = new Map();

        // Добавить векторные супер-модели
        this.vectorSuperModels = new Map(); // userId -> VectorSuperModel

        // Статистика системы
        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalComparisons: 0,
            successfulMerges: 0,
            totalPhotosProcessed: 0,
            trackerConfirmations: 0,
            lastActivity: new Date()
        };

        // Обеспечиваем существование директорий
        this.ensureDirectories();

        // Загружаем существующие модели
        this.loadExistingModels();

        console.log(`🚀 SimpleFootprintManager инициализирован`);
        console.log(`   📁 База данных: ${this.config.dbPath}`);
        console.log(`   🎯 Auto Alignment: ${this.config.autoAlignment ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   🎨 Визуализация объединения: ${this.config.enableMergeVisualization ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   🎯 PointTracker: ВКЛ (подтверждения узлов)`);
        console.log(`   🏗️  VectorSuperModel: ВКЛ`);
    }

    // ЗАМЕНИТЬ метод addPhotoToSession - УПРОЩЕННАЯ ВЕРСИЯ:
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО В СЕССИЮ (упрощенная версия)`);

        try {
            // Проверяем анализ
            if (!analysis || !analysis.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }

            // Извлекаем точки
            const points = this.extractPointsFromAnalysis(analysis);
            if (points.length < 5) {
                return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
            }

            console.log(`🔍 Извлечено ${points.length} точек протекторов`);

            // Получаем или создаем сессию
            let session = this.userSessions.get(userId);
            if (!session) {
                session = this.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
                console.log(`🆕 Создана новая сессия: ${session.id.slice(0, 8)}...`);
            }

            // Обновляем сессию
            session.photos.push({
                id: `photo_${Date.now()}`,
                timestamp: new Date(),
                pointsCount: points.length
            });
            session.lastActivity = new Date();

            // Если нет текущего отпечатка - создаем
            if (!session.currentFootprint) {
                console.log(`👣 Создаю новый отпечаток (первое фото)`);

                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`
                });

                // Добавляем анализ
                const addResult = session.currentFootprint.addAnalysis(analysis, photoInfo);

                // Создаем векторную супер-модель
                const vectorModel = new VectorSuperModel({
                    name: `Супер-модель_${userId.slice(0, 6)}`
                });
                vectorModel.addGraph(session.currentFootprint.graph, session.currentFootprint.id);
                this.vectorSuperModels.set(userId, vectorModel);

                console.log(`✅ Создан отпечаток с ${addResult.added} узлами`);

                return {
                    success: true,
                    isNewSession: true,
                    nodesAdded: addResult.added,
                    totalNodes: session.currentFootprint.graph.nodes.size,
                    sessionId: session.id
                };
            }

            // Есть существующий отпечаток - сравниваем
            console.log(`🔍 Сравниваю с существующим отпечатком (${session.currentFootprint.graph.nodes.size} узлов)`);

            // Создаем временный отпечаток для сравнения
            const tempFootprint = new SimpleFootprint({
                userId: userId,
                name: `Temp_${Date.now()}`
            });
            const tempResult = tempFootprint.addAnalysis(analysis, photoInfo);

            // Сравниваем графы
            const alignmentResult = await this.matcher.alignAndCompare(
                session.currentFootprint.graph,
                tempFootprint.graph,
                { userId: userId }
            );

            console.log(`📊 Результат сравнения: similarity=${alignmentResult.similarity.toFixed(3)}`);

            // Обновляем векторную супер-модель
            const vectorModel = this.vectorSuperModels.get(userId);
            let vectorVizPath = null;

            if (alignmentResult.similarity > 0.6) {
                // СЛЕДЫ СОВПАДАЮТ
                console.log(`✅ Следы совпали (${alignmentResult.similarity.toFixed(3)})`);

                // Добавляем временный граф в векторную супер-модель
                if (vectorModel) {
                    vectorModel.addGraph(tempFootprint.graph, tempFootprint.id, {
                        similarity: alignmentResult.similarity,
                        photoInfo: photoInfo
                    });

                    // Визуализируем
                    if (this.config.enableMergeVisualization) {
                        vectorVizPath = await this.visualizeVectorSuperModel(userId, vectorModel);
                    }
                }

                // Простое объединение основного графа
                this.simpleMergeGraphs(session.currentFootprint.graph, tempFootprint.graph);

                // Отправляем сообщение
                if (bot && chatId && vectorModel) {
                    const stats = vectorModel.getInfo();
                    await bot.sendMessage(chatId,
                        `✅ **Следы совпали - супер-модель обновлена!**\n\n` +
                        `🎯 Уверенность супер-модели: ${(stats.stats.confidence * 100).toFixed(1)}%\n` +
                        `📊 Узлов в супер-модели: ${stats.nodes}\n` +
                        `🔄 Подтверждённых узлов: ${stats.confirmedNodes}\n` +
                        `📈 Слияний: ${stats.stats.totalMerges}`
                    );
                }

                return {
                    success: true,
                    similarity: alignmentResult.similarity,
                    decision: 'same',
                    mergeMethod: 'vector_super_model',
                    vectorModelStats: vectorModel ? vectorModel.getInfo() : null,
                    visualization: vectorVizPath,
                    nodesAdded: tempResult.added
                };

            } else {
                // СЛЕДЫ РАЗНЫЕ
                console.log(`🆕 Следы разные (${alignmentResult.similarity.toFixed(3)}) - начинаю новую модель`);

                // Сохраняем текущий отпечаток
                if (session.currentFootprint.graph.nodes.size >= 10) {
                    this.saveSessionAsModel(userId, `Модель_${new Date().toLocaleTimeString('ru-RU')}`);
                }

                // Создаем новый отпечаток
                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`
                });

                const addResult = session.currentFootprint.addAnalysis(analysis, photoInfo);

                return {
                    success: true,
                    similarity: alignmentResult.similarity,
                    decision: 'different',
                    isNewModel: true,
                    nodesAdded: addResult.added
                };
            }

        } catch (error) {
            console.log(`❌ Ошибка: ${error.message}`);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    // ПРОСТОЕ ОБЪЕДИНЕНИЕ ГРАФОВ
    simpleMergeGraphs(mainGraph, tempGraph) {
        const previousSize = mainGraph.nodes.size;
        let matched = 0;

        // Просто копируем все узлы из временного графа
        tempGraph.nodes.forEach((tempNode, tempId) => {
            const newNodeId = `merged_${Date.now()}_${tempId}`;
            mainGraph.nodes.set(newNodeId, {
                ...tempNode,
                id: newNodeId,
                confirmedCount: 1
            });
        });

        // Перестраиваем граф
        const points = Array.from(mainGraph.nodes.values()).map(node => ({
            x: node.x,
            y: node.y,
            confidence: node.confidence || 0.5
        }));

        mainGraph.buildFromPoints(points);

        console.log(`🔄 Графы объединены: +${mainGraph.nodes.size - previousSize} узлов`);
        return mainGraph.nodes.size - previousSize;
    }

    // ВИЗУАЛИЗАЦИЯ ВЕКТОРНОЙ СУПЕР-МОДЕЛИ
    async visualizeVectorSuperModel(userId, vectorModel) {
        try {
            if (!vectorModel || !this.config.enableMergeVisualization) return null;

            const vizData = vectorModel.getVisualizationData();
            const stats = vectorModel.getInfo();

            const outputPath = path.join(
                this.config.dbPath,
                'visualizations',
                `vector_super_${userId}_${Date.now()}.png`
            );

            // Создаем директорию если нужно
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Создаем простую визуализацию
            const canvas = createCanvas(800, 600);
            const ctx = canvas.getContext('2d');

            // Фон
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, 800, 600);

            // Заголовок
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 24px Arial';
            ctx.fillText('🏗️ ВЕКТОРНАЯ СУПЕР-МОДЕЛЬ', 50, 50);

            // Статистика
            ctx.font = '16px Arial';
            ctx.fillText(`Всего узлов: ${vizData.nodes.length}`, 50, 100);
            ctx.fillText(`Подтверждённых: ${vizData.stats.confirmed}`, 50, 130);
            ctx.fillText(`Высоконадёжных: ${vizData.stats.highConfidence}`, 50, 160);
            ctx.fillText(`Уверенность: ${(vizData.stats.confidence * 100).toFixed(1)}%`, 50, 190);
            ctx.fillText(`Слияний: ${stats.stats.totalMerges}`, 50, 220);

            // Диаграмма узлов
            const padding = 100;
            const diagramSize = 400;
            const centerX = 400;
            const centerY = 400;

            vizData.nodes.forEach(node => {
                const x = centerX + (node.nx - 0.5) * diagramSize;
                const y = centerY + (node.ny - 0.5) * diagramSize;

                let color, size;
                if (node.confirmedCount >= 3) {
                    color = '#FF0000';
                    size = 8;
                } else if (node.confirmedCount === 2) {
                    color = '#FFA500';
                    size = 6;
                } else {
                    color = '#0066CC';
                    size = 4;
                }

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();

                // Номер подтверждений
                if (node.confirmedCount > 1) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = 'bold 10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(node.confirmedCount.toString(), x, y);
                }
            });

            // Легенда
            ctx.fillStyle = '#000000';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🔴 3+ фото  🟠 2 фото  🔵 1 фото', 400, 550);

            // Сохранить
            return new Promise((resolve, reject) => {
                const out = fs.createWriteStream(outputPath);
                const stream = canvas.createPNGStream();
                stream.pipe(out);
                out.on('finish', () => {
                    console.log(`✅ Векторная визуализация создана: ${outputPath}`);
                    resolve(outputPath);
                });
                out.on('error', reject);
            });

        } catch (error) {
            console.log(`⚠️ Ошибка визуализации: ${error.message}`);
            return null;
        }
    }

    // ПОЛУЧИТЬ ВЕКТОРНУЮ СУПЕР-МОДЕЛЬ
    getVectorSuperModel(userId) {
        return this.vectorSuperModels.get(userId);
    }

    // Создание сессии
    createSession(userId, name = null) {
        const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        const session = {
            id: sessionId,
            userId: userId,
            name: name || `Сессия_${new Date().toLocaleDateString('ru-RU')}`,
            startTime: new Date(),
            lastActivity: new Date(),
            photos: [],
            analyses: [],
            comparisons: [],
            confirmedPhotos: 0,
            currentFootprint: null,
            metadata: {
                created: new Date(),
                autoAlignment: this.config.autoAlignment,
                usePointTracker: true
            }
        };

        this.userSessions.set(userId, session);
        this.systemStats.totalUsers = this.userSessions.size;

        console.log(`🆕 Создана сессия ${sessionId.slice(0, 8)}... для пользователя ${userId}`);

        return session;
    }

    // Сохранение сессии как модели
    saveSessionAsModel(userId, modelName = null) {
        const session = this.userSessions.get(userId);
        if (!session || !session.currentFootprint) {
            return { success: false, error: 'Нет активной сессии или отпечатка' };
        }

        const footprint = session.currentFootprint;

        // Обновляем имя если указано
        if (modelName) {
            footprint.name = modelName;
        }

        // Сохраняем модель
        const modelPath = path.join(this.config.dbPath, 'models', `${footprint.id}.json`);

        try {
            const modelData = footprint.toJSON();
            modelData.metadata.sessionInfo = {
                sessionId: session.id,
                photosCount: session.photos.length,
                confirmedPhotos: session.confirmedPhotos || 0,
                analysesCount: session.analyses.length
            };

            fs.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));

            // Добавляем в загруженные модели
            this.loadedModels.set(footprint.id, footprint);
            this.systemStats.totalModels = this.loadedModels.size;

            console.log(`💾 Модель сохранена: ${footprint.id} (${footprint.graph.nodes.size} узлов)`);

            // Очищаем сессию
            this.userSessions.delete(userId);

            return {
                success: true,
                modelId: footprint.id,
                modelName: footprint.name,
                modelPath: modelPath,
                modelStats: {
                    nodes: footprint.graph.nodes.size,
                    edges: footprint.graph.edges.size,
                    confidence: footprint.stats.confidence,
                    confirmedNodes: 0
                },
                sessionInfo: {
                    photos: session.photos.length,
                    analyses: session.analyses.length,
                    confirmedPhotos: session.confirmedPhotos || 0
                }
            };

        } catch (error) {
            console.log('❌ Ошибка сохранения модели:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: ДОБАВЛЕНИЕ ВИЗУАЛИЗАЦИИ ОБЪЕДИНЕНИЯ В ИСТОРИЮ
    addMergeVisualization(userId, vizInfo) {
        const history = this.lastMergeVisualizations.get(userId) || [];
        history.unshift(vizInfo);

        // Ограничиваем историю 10 последними визуализациями
        if (history.length > 10) {
            history.pop();
        }

        this.lastMergeVisualizations.set(userId, history);
        return history.length;
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧЕНИЕ ПОСЛЕДНЕЙ ВИЗУАЛИЗАЦИИ ОБЪЕДИНЕНИЯ
    getLastMergeVisualization(userId) {
        const history = this.lastMergeVisualizations.get(userId);
        return history && history.length > 0 ? history[0] : null;
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧЕНИЕ СТАТИСТИКИ ПОДТВЕРЖДЕНИЙ ДЛЯ СЕССИИ
    getSessionConfirmationStats(userId) {
        const session = this.userSessions.get(userId);
        if (!session || !session.currentFootprint) {
            return null;
        }

        const footprint = session.currentFootprint;

        // Получаем статистику из отпечатка
        const stats = {
            totalNodes: footprint.graph.nodes.size,
            confirmedNodes: 0,
            averageConfirmations: 0
        };

        // Добавляем информацию о сессии
        return {
            sessionId: session.id,
            sessionName: session.name,
            photosCount: session.photos.length,
            confirmedPhotos: session.confirmedPhotos || 0,
            analysesCount: session.analyses.length,
            footprintStats: stats,
            lastActivity: session.lastActivity
        };
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧЕНИЕ КОЛИЧЕСТВА ВИЗУАЛИЗАЦИЙ ОБЪЕДИНЕНИЯ
    getMergeVisualizationCount() {
        let total = 0;
        for (const [userId, history] of this.lastMergeVisualizations) {
            total += history.length;
        }
        return total;
    }

    // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============

    // Вспомогательные методы
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

    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'models'),
            path.join(this.config.dbPath, 'sessions'),
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

        if (!fs.existsSync(modelsDir)) {
            console.log('📁 Директория моделей не существует, создаю...');
            fs.mkdirSync(modelsDir, { recursive: true });
            return;
        }

        const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.json'));

        console.log(`📂 Загрузка моделей из ${modelsDir} (${files.length} файлов)`);

        let loadedCount = 0;

        files.slice(0, 100).forEach(file => { // Ограничиваем загрузку 100 моделями
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
        console.log(`✅ Загружено ${loadedCount} моделей`);
    }

    // Остальные методы остаются без изменений
    getActiveSession(userId) {
        return this.userSessions.get(userId);
    }

    getUserModels(userId) {
        return Array.from(this.loadedModels.values())
            .filter(model => model.userId === userId)
            .sort((a, b) => new Date(b.metadata.created) - new Date(a.metadata.created));
    }

    getModelById(modelId) {
        return this.loadedModels.get(modelId);
    }

    getSystemStats() {
        return {
            ...this.systemStats,
            activeSessions: this.userSessions.size,
            loadedModels: this.loadedModels.size,
            mergeVisualizations: this.getMergeVisualizationCount(),
            vectorModels: this.vectorSuperModels.size,
            config: {
                autoAlignment: this.config.autoAlignment,
                enableMergeVisualization: this.config.enableMergeVisualization,
                usePointTracker: this.config.usePointTracker,
                topologySimilarityThreshold: this.config.topologySimilarityThreshold
            },
            system: {
                uptime: Math.floor(process.uptime()),
                memoryUsage: process.memoryUsage()
            }
        };
    }

    endSession(userId, reason = 'manual') {
        const session = this.userSessions.get(userId);
        if (!session) {
            return { success: false, error: 'Сессия не найдена' };
        }

        const result = {
            success: true,
            sessionId: session.id,
            userId: userId,
            reason: reason,
            duration: new Date() - session.startTime,
            photos: session.photos.length,
            analyses: session.analyses.length,
            confirmedPhotos: session.confirmedPhotos || 0,
            footprint: session.currentFootprint ? {
                id: session.currentFootprint.id,
                nodes: session.currentFootprint.graph.nodes.size,
                confidence: session.currentFootprint.stats.confidence
            } : null
        };

        // Удаляем сессию
        this.userSessions.delete(userId);

        console.log(`🏁 Сессия завершена: ${session.id.slice(0, 8)}... (${reason})`);

        return result;
    }

    saveSession(userId) {
        const session = this.userSessions.get(userId);
        if (!session) return false;

        try {
            const sessionPath = path.join(this.config.dbPath, 'sessions', `${session.id}.json`);
            const sessionData = {
                id: session.id,
                userId: session.userId,
                name: session.name,
                startTime: session.startTime.toISOString(),
                lastActivity: session.lastActivity.toISOString(),
                photos: session.photos,
                analyses: session.analyses,
                comparisons: session.comparisons,
                confirmedPhotos: session.confirmedPhotos,
                metadata: session.metadata
            };

            fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
            return true;
        } catch (error) {
            console.log('⚠️ Ошибка сохранения сессии:', error.message);
            return false;
        }
    }

    // Визуализация сравнения
    async visualizeComparison(modelId1, modelId2) {
        try {
            const model1 = this.getModelById(modelId1);
            const model2 = this.getModelById(modelId2);

            if (!model1 || !model2) {
                return { success: false, error: 'Модели не найдены' };
            }

            const comparison = model1.compare(model2);
            const vizPath = await this.mergeVisualizer.visualizeMerge(
                model1,
                model2,
                comparison
            );

            return {
                success: true,
                visualization: vizPath.path,
                comparison: comparison
            };

        } catch (error) {
            console.log('❌ Ошибка визуализации сравнения:', error);
            return { success: false, error: error.message };
        }
    }

    // Визуализация сессии
    async visualizeSession(userId) {
        const session = this.getActiveSession(userId);
        if (!session || !session.currentFootprint) {
            return { success: false, error: 'Нет активной сессии' };
        }

        try {
            const GraphVisualizer = require('./graph-visualizer');
            const visualizer = new GraphVisualizer();

            const vizPath = await visualizer.visualizeSessionHistory(session, {
                filename: `session_${session.id.slice(0, 8)}.png`
            });

            return {
                success: true,
                visualization: vizPath,
                sessionId: session.id,
                footprint: {
                    nodes: session.currentFootprint.graph.nodes.size,
                    edges: session.currentFootprint.graph.edges.size
                }
            };

        } catch (error) {
            console.log('❌ Ошибка визуализации сессии:', error);
            return { success: false, error: error.message };
        }
    }

    // Поиск похожих моделей
    findSimilarModels(footprint, userId, options = {}) {
        const userModels = this.getUserModels(userId);
        const maxResults = options.maxResults || 5;
        const minSimilarity = options.minSimilarity || 0.4;

        const similarities = [];

        userModels.forEach(model => {
            if (model.id === footprint.id) return; // Пропускаем ту же модель

            const comparison = footprint.compare(model);

            if (comparison.similarity >= minSimilarity) {
                similarities.push({
                    model: model,
                    similarity: comparison.similarity,
                    decision: comparison.decision,
                    reason: comparison.reason
                });
            }
        });

        // Сортировка по схожести
        similarities.sort((a, b) => b.similarity - a.similarity);

        return {
            success: true,
            similarCount: similarities.length,
            similarModels: similarities.slice(0, maxResults),
            searchedModels: userModels.length
        };
    }

    // Очистка старых сессий
    cleanupOldSessions(maxAgeHours = 24) {
        const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        let cleaned = 0;

        for (const [userId, session] of this.userSessions) {
            if (session.lastActivity.getTime() < cutoffTime) {
                this.userSessions.delete(userId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Очищено ${cleaned} старых сессий`);
        }

        return cleaned;
    }
}

module.exports = SimpleFootprintManager;
