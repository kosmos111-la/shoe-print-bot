// modules/footprint/simple-manager.js
// УПРОЩЕННЫЙ МЕНЕДЖЕР ЦИФРОВЫХ ОТПЕЧАТКОВ С АВТОСОВМЕЩЕНИЕМ И POINT TRACKER

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 🔥 ДОБАВЛЕНО: Импорт SimpleGraph который отсутствовал
const SimpleGraph = require('./simple-graph');

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

        // 🔥 ДОБАВЛЕНО: Импорт модулей внутри конструктора (строго по инструкции)
        const SimpleFootprint = require('./simple-footprint');
        const SimpleMatcher = require('./simple-matcher');
        const MergeVisualizer = require('./merge-visualizer');
        const VectorSuperModel = require('./vector-super-model');
        const TemplateVisualizer = require('./template-visualizer');

        // 🔥 ДОБАВЛЕНО: НОВЫЕ ИМПОРТЫ согласно инструкции
        const RotationInvariance = require('./rotation-invariance');
        const MirrorDetection = require('./mirror-detection');

        // 🔥 ДОБАВЛЕНО: Процессоры поворотной инвариантности согласно инструкции
        this.rotationProcessor = new RotationInvariance({
            debug: this.config.debug
        });

        this.mirrorDetector = new MirrorDetection({
            debug: this.config.debug
        });

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

        // Добавляем TemplateVisualizer
        this.templateVisualizer = new TemplateVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations/templates'),
            debug: this.config.debug
        });

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

        console.log(`🚀 SimpleFootprintManager инициализирован с поворотной инвариантностью`);
        console.log(`   📁 База данных: ${this.config.dbPath}`);
        console.log(`   🎯 Auto Alignment: ${this.config.autoAlignment ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   🎨 Визуализация объединения: ${this.config.enableMergeVisualization ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   🎯 PointTracker: ВКЛ (подтверждения узлов)`);
        console.log(`   🏗️  VectorSuperModel: ВКЛ`);
        console.log(`   📐 TemplateVisualizer: ВКЛ`);
        console.log(`   🔄 Поворотная инвариантность: ВКЛ`);
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД addPhotoToSession с поворотной инвариантностью
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО С ПОВОРОТНОЙ ИНВАРИАНТНОСТЬЮ`);

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

            // 🔥 ИСПРАВЛЕНИЕ: Создание графа с использованием импортированного SimpleGraph
            const graph = new SimpleGraph(`Временный_${Date.now()}`);
            graph.buildFromPoints(points);

            // 🔥 ДОБАВЛЕНО: Автоматическая нормализация ориентации согласно инструкции
            const normalized = this.rotationProcessor.normalizeToCanonical(graph, {
                userId: userId,
                photoInfo: photoInfo,
                autoRotate: true
            });

            console.log(`📐 Автоповорот: ${normalized.rotationAngle.toFixed(1)}° → 0°`);
            console.log(`🪞 Зеркало: ${normalized.isMirrored ? 'да' : 'нет'}`);
            console.log(`🦶 Тип: ${normalized.footType || 'неизвестно'}`);

            // 🔥 ДОБАВЛЕНО: Автокоррекция типа следа (все к правому)
            const corrected = this.mirrorDetector.autoCorrectMirroring(
                normalized.graph,
                'right'
            );

            if (corrected.correctionApplied) {
                console.log(`🔄 Автокоррекция применена: ${corrected.correctionType}`);
            }

            // Используем корректированный граф для дальнейшей обработки
            const finalGraph = corrected.graph;

            // Получаем или создаем сессию
            let session = this.userSessions.get(userId);
            if (!session) {
                session = this.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
                console.log(`🆕 Создана новая сессию: ${session.id ? session.id.slice(0, 8) : 'unknown'}...`);
            }

            // Обновляем сессию
            session.photos.push({
                id: `photo_${Date.now()}`,
                timestamp: new Date(),
                pointsCount: points.length
            });
            session.lastActivity = new Date();

            // 🔥 ИСПРАВЛЕНИЕ: Используем импортированные модули
            const SimpleFootprint = require('./simple-footprint');

            // Если нет текущего отпечатка - создаем
            if (!session.currentFootprint) {
                console.log(`👣 Создаю новый отпечаток (первое фото)`);

                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`
                });

                // 🔥 ИСПРАВЛЕНИЕ: Используем addAnalysisHonest вместо addAnalysis
                const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
                    ...photoInfo,
                    normalizedGraph: finalGraph,
                    photoId: photoInfo.photoId || `photo_${Date.now()}`,
                    source: photoInfo.source || 'telegram_bot'
                });

                // Создаем векторную супер-модель
                const VectorSuperModel = require('./vector-super-model');
                const vectorModel = new VectorSuperModel({
                    name: `Супер-модель_${String(userId).slice(0, 6)}`,
                    enablePCA: false,
                    cellSize: 25,
                    debug: this.config.debug
                });

                vectorModel.addGraph(finalGraph, session.currentFootprint.id, { isFirst: true });
                this.vectorSuperModels.set(userId, vectorModel);

                console.log(`✅ Создан отпечаток с ${addResult.added} узлами`);

                return {
                    success: true,
                    isNewSession: true,
                    similarity: 0, // ✅ ДОБАВЛЕНО: similarity для первого фото
                    decision: 'new', // ✅ ДОБАВЛЕНО: decision для первого фото
                    nodesAdded: addResult.added,
                    totalNodes: session.currentFootprint.graph.nodes.size,
                    sessionId: session.id,
                    rotationInfo: {
                        angle: normalized.rotationAngle,
                        isMirrored: normalized.isMirrored,
                        corrected: corrected.correctionApplied
                    }
                };
            }

            // Есть существующий отпечаток - сравниваем
            console.log(`🔍 Сравниваю с существующим отпечатком (${session.currentFootprint.graph.nodes.size} узлов)`);

            // Создаем временный отпечаток для сравнения
            const tempFootprint = new SimpleFootprint({
                userId: userId,
                name: `Temp_${Date.now()}`
            });
           
            // 🔥 ИСПРАВЛЕНИЕ: Используем addAnalysisHonest вместо addAnalysis для временного отпечатка
            const tempResult = tempFootprint.addAnalysisHonest(analysis, {
                ...photoInfo,
                normalizedGraph: finalGraph,
                photoId: photoInfo.photoId || `photo_${Date.now()}_temp`,
                source: photoInfo.source || 'telegram_bot_temp'
            });

            // Сравниваем с использованием поворотной инвариантности
            const alignmentResult = await this.matcher.compareGraphs(
                session.currentFootprint.graph,
                tempFootprint.graph,
                { userId: userId, photoId: photoInfo.photoId }
            );

            // 🔥 ДОБАВЛЕНО: Детальное логирование для debug
            console.log('🔍 DEBUG alignmentResult структура:');
            console.log('- Тип:', typeof alignmentResult);
            console.log('- Ключи:', Object.keys(alignmentResult || {}));
            console.log('- Значение similarity:', alignmentResult?.similarity);
            console.log('- Значение decision:', alignmentResult?.decision);
            console.log('- Полный объект:', JSON.stringify(alignmentResult, null, 2).substring(0, 500));

            let similarity = 0;
            let decision = 'unknown';

            // 🔥 ИСПРАВЛЕНО: Гарантируем возврат similarity
            if (alignmentResult && typeof alignmentResult.similarity === 'number') {
                similarity = alignmentResult.similarity;
                decision = alignmentResult.decision || 'unknown';
                console.log(`📊 Использую direct similarity: ${similarity.toFixed(3)}, decision: ${decision}`);
            }
            else if (alignmentResult && alignmentResult.result) {
                const result = alignmentResult.result;
                if (typeof result.similarity === 'number') {
                    similarity = result.similarity;
                    decision = result.decision || 'unknown';
                    console.log(`📊 Использую result.similarity: ${similarity.toFixed(3)}, decision: ${decision}`);
                }
            }

            // 🔥 ДОБАВЛЕНО: Универсальное извлечение similarity
            if (similarity === 0 && alignmentResult) {
                const foundSimilarity = this.extractSimilarityFromObject(alignmentResult);
                if (foundSimilarity) {
                    similarity = foundSimilarity.value;
                    decision = foundSimilarity.decision || 'unknown';
                    console.log(`📊 Извлечено similarity: ${similarity.toFixed(3)} из глубины объекта`);
                }
            }

            // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Если similarity все еще NaN или не число, исправляем
            if (isNaN(similarity) || typeof similarity !== 'number') {
                console.log(`⚠️ similarity не число или NaN: ${similarity}, исправляю на 0`);
                similarity = 0;
                decision = 'different';
            }

            // 🔥 ГАРАНТИРОВАННЫЙ РЕЗУЛЬТАТ
            const finalSimilarity = Math.max(0, Math.min(1, similarity));
            const finalDecision = decision !== 'unknown' ? decision :
                                (finalSimilarity > 0.6 ? 'same' : 'different');

            console.log(`🎯 Финальное: similarity=${finalSimilarity.toFixed(3)}, decision=${finalDecision}`);

            // 🔥 УПРОЩЕННАЯ ЛОГИКА:
            if (finalSimilarity > 0.6 && finalDecision === 'same') {
                // СЛЕДЫ СОВПАДАЮТ
                console.log(`✅ Следы совпали (${finalSimilarity.toFixed(3)})`);

                // Получаем векторную модель
                let vectorModel = this.vectorSuperModels.get(userId);
                let vectorVizPath = null;

                if (!vectorModel) {
                    // Создаем модель
                    const VectorSuperModel = require('./vector-super-model');
                    vectorModel = new VectorSuperModel({
                        name: `Супер-модель_${String(userId).slice(0, 6)}`,
                        enablePCA: false,
                        cellSize: 25,
                        debug: this.config.debug
                    });
                    this.vectorSuperModels.set(userId, vectorModel);

                    // Добавляем текущий граф
                    vectorModel.addGraph(
                        session.currentFootprint.graph,
                        session.currentFootprint.id,
                        { isFirst: true }
                    );
                }

                // Добавляем новый граф
                const addResult = vectorModel.addGraph(
                    finalGraph,
                    tempFootprint.id,
                    {
                        similarity: finalSimilarity,
                        timestamp: new Date(),
                        ...photoInfo
                    }
                );

                if (addResult) {
                    // Обновляем подтверждения
                    this.updateConfirmationsFromVectorModel(session.currentFootprint, vectorModel);

                    // Визуализация
                    if (this.config.enableMergeVisualization && vectorModel) {
                        vectorVizPath = await this.visualizeVectorSuperModel(userId, vectorModel);

                        // 🔥 ИСПРАВЛЕНИЕ: Отправляем в Telegram прямо здесь
                        if (bot && chatId && vectorVizPath && vectorVizPath.template) {
                            try {
                                const stats = vectorModel.getInfo();

                                // Проверяем что файл существует
                                if (fs.existsSync(vectorVizPath.template)) {
                                    await bot.sendPhoto(chatId, vectorVizPath.template, {
                                        caption: `✅ **Следы совпали - супер-модель обновлена!**\n\n` +
                                                `🎯 Уверенность: ${(stats.stats.confidence * 100).toFixed(1)}%\n` +
                                                `📊 Ячеек шаблона: ${stats.template?.cells?.total || 0}\n` +
                                                `🔄 Подтверждённых: ${stats.template?.cells?.confirmed || 0}\n` +
                                                `📈 Слияний: ${stats.stats.totalMerges}\n\n` +
                                                `🎨 Шаблон протектора с подтверждениями`
                                    });
                                    console.log(`✅ Визуализация отправлена в Telegram`);

                                    // 🔥 ИСПРАВЛЕНИЕ: Отправляем тепловую карту, если она есть
                                    if (vectorVizPath.heatmap && fs.existsSync(vectorVizPath.heatmap)) {
                                        await bot.sendPhoto(chatId, vectorVizPath.heatmap, {
                                            caption: `🔥 Тепловая карта подтверждений\n` +
                                                    `🔴 Высокая теплота (много подтверждений)\n` +
                                                    `🟡 Средняя теплота\n` +
                                                    `🔵 Низкая теплота`
                                        });
                                        console.log(`🔥 Тепловая карта отправлена в Telegram`);
                                    }
                                } else {
                                    console.log(`❌ Файл не существует: ${vectorVizPath.template}`);
                                }
                            } catch (sendError) {
                                console.log(`❌ Ошибка отправки визуализации: ${sendError.message}`);
                            }
                        }
                    }

                    // 🔥 ИСПРАВЛЕННЫЙ ВОЗВРАЩАЕМЫЙ ОБЪЕКТ с similarity и decision
                    const result = {
                        success: true,
                        similarity: finalSimilarity,  // ✅ ГАРАНТИРОВАНО
                        decision: finalDecision,      // ✅ ГАРАНТИРОВАНО
                        nodesAdded: tempResult.added,
                        hasMergeVisualization: true,
                        mergeMethod: 'template_based',
                        templateStats: vectorModel ? vectorModel.getTemplateStats() : null,
                        visualization: vectorVizPath,
                        message: `✅ След добавлен к шаблону! Сходство: ${(finalSimilarity * 100).toFixed(1)}%`,
                        rotationInfo: {
                            angle: normalized.rotationAngle,
                            isMirrored: normalized.isMirrored,
                            corrected: corrected.correctionApplied
                        }
                    };

                    // 🔥 ИСПРАВЛЕНО: Правильное логирование результата
                    console.log(`📊 Результат addPhotoToSession: {
  success: true,
  similarity: ${finalSimilarity.toFixed(3)},
  decision: ${finalDecision},
  nodesAdded: ${tempResult.added},
  hasMergeVisualization: ${true},
  mergeMethod: 'template_based'
}`);

                    return result;
                }

            } else {
                // СЛЕДЫ РАЗНЫЕ
                console.log(`🆕 Следы разные (${finalSimilarity.toFixed(3)}) - начинаю новую модель`);

                // Сохраняем текущий отпечаток
                if (session.currentFootprint.graph.nodes.size >= 10) {
                    this.saveSessionAsModel(userId, `Модель_${new Date().toLocaleTimeString('ru-RU')}`);
                }

                // Создаем новый отпечаток
                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`
                });

                // 🔥 ИСПРАВЛЕНИЕ: Используем addAnalysisHonest вместо addAnalysis
                const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
                    ...photoInfo,
                    normalizedGraph: finalGraph,
                    photoId: photoInfo.photoId || `photo_${Date.now()}`,
                    source: photoInfo.source || 'telegram_bot'
                });

                const result = {
                    success: true,
                    similarity: finalSimilarity,
                    decision: finalDecision,
                    isNewModel: true,
                    nodesAdded: addResult.added,
                    rotationInfo: {
                        angle: normalized.rotationAngle,
                        isMirrored: normalized.isMirrored,
                        corrected: corrected.correctionApplied
                    }
                };

                console.log(`📊 Результат addPhotoToSession (разные следы): {
  success: true,
  similarity: ${finalSimilarity.toFixed(3)},
  decision: ${finalDecision},
  isNewModel: true,
  nodesAdded: ${addResult.added}
}`);

                return result;
            }

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error.stack);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Извлечение similarity из любого объекта
    extractSimilarityFromObject(obj, path = '') {
        if (!obj || typeof obj !== 'object') return null;

        // Ищем similarity на всех уровнях
        for (const key in obj) {
            if (key === 'similarity' && typeof obj[key] === 'number') {
                // Ищем decision рядом
                const decision = obj.decision ||
                               obj.result?.decision ||
                               obj.details?.decision ||
                               'unknown';

                return {
                    value: obj[key],
                    decision: decision,
                    path: path ? `${path}.${key}` : key
                };
            }

            if (typeof obj[key] === 'object' && obj[key] !== null) {
                const found = this.extractSimilarityFromObject(obj[key], key);
                if (found) return found;
            }
        }

        return null;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Визуализация векторной супер-модели
    async visualizeVectorSuperModel(userId, vectorModel) {
        console.log(`🎨 Создаю визуализацию ШАБЛОНА...`);

        try {
            if (!vectorModel) {
                console.log('⚠️ Нет векторной модели');
                return null;
            }

            // 🔥 ПОЛУЧАЕМ ДАННЫЕ ШАБЛОНА
            let templateData = vectorModel.getVisualizationData();

            if (!templateData || !templateData.cells || templateData.cells.length === 0) {
                console.log('⚠️ ШАБЛОН ПУСТ! Получаем сырые данные...');
                if (vectorModel.templateBuilder) {
                    templateData = vectorModel.templateBuilder.getVisualizationData();
                    console.log(`📊 Прямые данные шаблона: ${templateData?.cells?.length || 0} ячеек`);
                }
            }

            console.log(`📊 Данные шаблона: ${templateData?.cells?.length || 0} ячеек`);

            // 🔥 ИСПОЛЬЗУЕМ TEMPLATE VISUALIZER
            const result = await this.templateVisualizer.visualizeTemplate(templateData, {
                filename: `template_${userId}_${Date.now()}.png`
            });

            // Также создаем тепловую карту
            const heatmapResult = await this.templateVisualizer.createHeatmap(templateData, {
                filename: `heatmap_${userId}_${Date.now()}.png`
            });

            // 🔥 ИСПРАВЛЕНИЕ: Извлекаем путь из объекта
            let heatmapPath = heatmapResult;
            if (heatmapResult && typeof heatmapResult === 'object' && heatmapResult.path) {
                heatmapPath = heatmapResult.path;
            }

            console.log(`✅ Шаблон визуализирован: ${result.path}`);
            console.log(`🔥 Тепловая карта: ${heatmapPath}`);

            return {
                template: result.path,
                heatmap: heatmapPath, // ✅ Теперь точно строка
                stats: templateData?.stats,
                templateId: templateData?.templateId
            };

        } catch (error) {
            console.log(`❌ Ошибка визуализации шаблона: ${error.message}`);
            console.error(error.stack);
            return null;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: обновить подтверждения из векторной модели
    updateConfirmationsFromVectorModel(footprint, vectorModel) {
        if (!footprint || !footprint.graph || !vectorModel || !vectorModel.templateBuilder) {
            return;
        }

        const templateInfo = vectorModel.templateBuilder.getInfo();
        console.log(`🔧 Обновляю подтверждения в отпечатке из шаблона (${templateInfo.confirmedCells} ячеек)`);

        // Просто обновляем счетчик подтверждений в узлах графа
        footprint.graph.nodes.forEach((node, nodeId) => {
            // Найти, в какой ячейке находится этот узел
            for (const [cellId, cell] of vectorModel.templateBuilder.templateCells) {
                const dx = node.x - cell.center.x;
                const dy = node.y - cell.center.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < (cell.radius || vectorModel.templateBuilder.config.cellSize / 2)) {
                    // Узел находится в этой ячейке
                    if (!node.confirmedCount) node.confirmedCount = 0;
                    node.confirmedCount = Math.max(node.confirmedCount, cell.confirmations || 1);
                    node.confidence = cell.confidence || 0.7;
                    break;
                }
            }
        });
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД СОЗДАНИЯ СЕССИИ
    createSession(userId, name = null) {
        const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        const session = {
            id: sessionId, // ✅ Правильный ID
            userId: String(userId), // ✅ Конвертируем в строку
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

    /**
     * УДАЛИТЬ ВЕКТОРНУЮ СУПЕР-МОДЕЛЬ пользователя
     */
    clearVectorSuperModel(userId) {
        console.log(`🗑️ Очищаю векторную супер-модель для пользователя ${userId}...`);

        const vectorModel = this.vectorSuperModels.get(userId);
        if (!vectorModel) {
            console.log(`⚠️ У пользователя ${userId} нет супер-модели`);
            return { success: false, reason: 'Нет супер-модели' };
        }

        // Получаем статистику перед удалением
        const oldStats = vectorModel.getInfo();

        // Удаляем модель
        this.vectorSuperModels.delete(userId);

        console.log(`✅ Супер-модель удалена: ${oldStats.name}`);
        console.log(`   📊 Было: ${oldStats.template?.cells?.total || 0} ячеек, ${oldStats.stats?.totalMerges || 0} слияний`);

        return {
            success: true,
            deletedModel: oldStats.name,
            stats: {
                cells: oldStats.template?.cells?.total || 0,
                merges: oldStats.stats?.totalMerges || 0,
                confidence: oldStats.stats?.confidence || 0
            },
            timestamp: new Date()
        };
    }

    /**
     * ОЧИСТИТЬ ВСЕ ДАННЫЕ СЕССИИ (супер-модель + отпечаток)
     */
    clearUserSessionData(userId) {
        console.log(`🧹 Полная очистка данных для пользователя ${userId}...`);

        const results = {
            vectorModel: false,
            session: false,
            currentFootprint: false
        };

        // 1. Удалить векторную супер-модель
        const vectorModel = this.vectorSuperModels.get(userId);
        if (vectorModel) {
            this.vectorSuperModels.delete(userId);
            results.vectorModel = true;
            console.log(`✅ Удалена векторная супер-модель`);
        }

        // 2. Очистить текущий отпечаток в сессии
        const session = this.userSessions.get(userId);
        if (session && session.currentFootprint) {
            const oldFootprintInfo = {
                id: session.currentFootprint.id,
                nodes: session.currentFootprint.graph.nodes.size,
                edges: session.currentFootprint.graph.edges.size
            };

            session.currentFootprint = null;
            results.currentFootprint = true;

            console.log(`✅ Удален текущий отпечаток: ${oldFootprintInfo.id}`);
            console.log(`   📊 Было: ${oldFootprintInfo.nodes} узлов, ${oldFootprintInfo.edges} рёбер`);
        }

        // 3. Очистить PointTracker в сессии
        if (session && session.currentFootprint && session.currentFootprint.pointTracker) {
            const trackerStats = session.currentFootprint.pointTracker.getStats();
            session.currentFootprint.pointTracker = new (require('./point-tracker'))();
            console.log(`✅ Очищен PointTracker (было ${trackerStats.totalPoints} точек)`);
        }

        return {
            success: results.vectorModel || results.currentFootprint || results.session,
            results: results,
            timestamp: new Date()
        };
    }

    /**
     * ПОЛУЧИТЬ ИНФОРМАЦИЮ О СУПЕР-МОДЕЛИ
     */
    getVectorSuperModelInfo(userId) {
        const vectorModel = this.vectorSuperModels.get(userId);
        if (!vectorModel) {
            return { exists: false, message: 'Супер-модель не найдена' };
        }

        const info = vectorModel.getInfo();
        const templateStats = vectorModel.getTemplateStats ? vectorModel.getTemplateStats() : {};

        return {
            exists: true,
            name: info.name,
            templateId: info.id,
            stats: {
                totalCells: info.template?.cells?.total || 0,
                confirmedCells: info.template?.cells?.confirmed || 0,
                totalMerges: info.stats?.totalMerges || 0,
                confidence: info.stats?.confidence || 0,
                createdAt: info.stats?.createdAt || 'N/A',
                lastUpdated: info.stats?.lastUpdated || 'N/A'
            },
            templateStats: templateStats,
            hasTemplateBuilder: !!vectorModel.templateBuilder
        };
    }

    // ПОЛУЧИТЬ ВЕКТОРНУЮ СУПЕР-МОДЕЛЬ
    getVectorSuperModel(userId) {
        return this.vectorSuperModels.get(userId);
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

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧИЕНИЕ КОЛИЧЕСТВА ВИЗУАЛИЗАЦИЙ ОБЪЕДИНЕНИЯ
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
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'visualizations/templates')
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
            console.log('📁 Директория моделей не существует, создаю...');
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

    // Остальные методы без изменений...
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
