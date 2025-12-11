// modules/footprint/simple-manager.js
// МЕНЕДЖЕР СИСТЕМЫ ЦИФРОВЫХ ОТПЕЧАТКОВ - УПРАВЛЕНИЕ ВСЕМ (С ИНТЕЛЛЕКТУАЛЬНЫМ СЛИЯНИЕМ)

const fs = require('fs');
const path = require('path');
const SimpleFootprint = require('./simple-footprint');
const SimpleGraphMatcher = require('./simple-matcher');
const HybridFootprint = require('./hybrid-footprint');
const MergeVisualizer = require('./merge-visualizer');

class SimpleFootprintManager {
    constructor(options = {}) {
        // Конфигурация
        this.config = {
            dbPath: options.dbPath || './data/footprints',
            autoAlignment: options.autoAlignment !== false,
            autoSave: options.autoSave !== false,
            maxModelsPerUser: options.maxModelsPerUser || 50,
            debug: options.debug || false,
            useHybridMode: options.useHybridMode !== false,
            hybridSearchThreshold: options.hybridSearchThreshold || 0.6,
            enableMergeVisualization: options.enableMergeVisualization !== false,
            enableIntelligentMerge: options.enableIntelligentMerge !== false, // 🔴 НОВАЯ ОПЦИЯ
            ...options
        };

        // Инициализация компонентов
        this.matcher = new SimpleGraphMatcher({
            debug: this.config.debug,
            enableDetailedMatch: true
        });

        // 🔴 ИНИЦИАЛИЗАЦИЯ ВИЗУАЛИЗАТОРА ОБЪЕДИНЕНИЙ
        this.mergeVisualizer = new MergeVisualizer();

        // Хранилища
        this.userSessions = new Map();      // userId -> session
        this.userModels = new Map();        // userId -> [footprints]
        this.activeSessions = new Map();    // sessionId -> session
        this.modelCache = new Map();        // modelId -> footprint

        // Статистика
        this.stats = {
            totalSessions: 0,
            totalModels: 0,
            totalComparisons: 0,
            successfulAlignments: 0,
            hybridComparisons: 0,
            hybridSearches: 0,
            mergeVisualizations: 0,
            intelligentMerges: 0, // 🔴 ДОБАВЛЕНО
            startedAt: new Date()
        };

        // Визуализация
        this.graphVisualizer = null;

        // Инициализация
        this.ensureDatabase();
        this.loadAllModels();
        this.initializeVisualizer();

        console.log(`🚀 SimpleFootprintManager инициализирован`);
        console.log(`📁 База данных: ${this.config.dbPath}`);
        console.log(`🎯 Автосовмещение: ${this.config.autoAlignment ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);
        console.log(`🎯 Гибридный режим: ${this.config.useHybridMode ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
        console.log(`🎨 Визуализация объединений: ${this.config.enableMergeVisualization ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
        console.log(`🧠 Интеллектуальное слияние: ${this.config.enableIntelligentMerge ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`); // 🔴 ДОБАВЛЕНО
    }

    // 1. ОБЕСПЕЧИТЬ СУЩЕСТВОВАНИЕ БАЗЫ ДАННЫХ
    ensureDatabase() {
        try {
            if (!fs.existsSync(this.config.dbPath)) {
                fs.mkdirSync(this.config.dbPath, { recursive: true });
                console.log(`✅ Создана папка базы данных: ${this.config.dbPath}`);
            }

            // Создать индексный файл
            const indexPath = path.join(this.config.dbPath, '_index.json');
            if (!fs.existsSync(indexPath)) {
                const index = {
                    version: '1.1',
                    created: new Date().toISOString(),
                    totalModels: 0,
                    hybridModels: 0,
                    users: {},
                    stats: this.stats
                };
                fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
            }

            // 🔴 СОЗДАТЬ ПАПКУ ДЛЯ ВИЗУАЛИЗАЦИЙ ОБЪЕДИНЕНИЯ
            const mergeVizDir = path.join(this.config.dbPath, 'merge_visualizations');
            if (!fs.existsSync(mergeVizDir)) {
                fs.mkdirSync(mergeVizDir, { recursive: true });
                console.log(`📁 Создана папка для визуализаций объединений: ${mergeVizDir}`);
            }
        } catch (error) {
            console.log(`❌ Ошибка создания базы данных: ${error.message}`);
        }
    }

    // 2. ЗАГРУЗИТЬ ВСЕ МОДЕЛИ ИЗ БАЗЫ
    loadAllModels() {
        try {
            if (!fs.existsSync(this.config.dbPath)) {
                console.log('📭 Папка базы данных не существует, моделей нет');
                return;
            }

            const files = fs.readdirSync(this.config.dbPath);
            const jsonFiles = files.filter(f => f.endsWith('.json') && f !== '_index.json');

            console.log(`📂 Найдено ${jsonFiles.length} файлов моделей`);

            let loaded = 0;
            let errors = 0;
            let hybridLoaded = 0;

            jsonFiles.forEach(filename => {
                try {
                    const filePath = path.join(this.config.dbPath, filename);
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                    const footprint = SimpleFootprint.fromJSON(data);

                    // Добавить в кэш
                    this.modelCache.set(footprint.id, footprint);

                    // Добавить в пользовательский индекс
                    if (footprint.userId) {
                        if (!this.userModels.has(footprint.userId)) {
                            this.userModels.set(footprint.userId, []);
                        }
                        this.userModels.get(footprint.userId).push(footprint);
                    }

                    loaded++;

                    // Подсчитать гибридные модели
                    if (footprint.hybridFootprint) {
                        hybridLoaded++;
                    }

                    if (this.config.debug && loaded <= 3) {
                        console.log(`   📦 Загружена модель: ${footprint.name} (${footprint.graph.nodes.size} узлов)`);
                        if (footprint.hybridFootprint) {
                            console.log(`      🎯 Гибридный: моменты=${footprint.hybridFootprint.moments?.length || 0}`);
                        }
                    }

                } catch (error) {
                    console.log(`⚠️ Ошибка загрузки ${filename}: ${error.message}`);
                    errors++;
                }
            });

            // Обновить статистику
            this.stats.totalModels = loaded;
            this.stats.hybridModels = hybridLoaded;

            console.log(`✅ Загружено ${loaded} моделей (${errors} ошибок)`);
            console.log(`🎯 Гибридных моделей: ${hybridLoaded}`);
            console.log(`👥 Пользователей с моделями: ${this.userModels.size}`);

        } catch (error) {
            console.log(`❌ Ошибка загрузки моделей: ${error.message}`);
        }
    }

    // 3. СОЗДАТЬ НОВУЮ СЕССИЮ
    createSession(userId, sessionName = null) {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const name = sessionName || `Сессия_${new Date().toLocaleDateString('ru-RU')}`;

        const session = {
            id: sessionId,
            userId: userId,
            name: name,
            startTime: new Date(),
            lastActivity: new Date(),
            photos: [],
            analyses: [],
            currentFootprint: null,
            status: 'active',
            useHybrid: this.config.useHybridMode,
            useIntelligentMerge: this.config.enableIntelligentMerge, // 🔴 ДОБАВЛЕНО
            stats: {
                photoCount: 0,
                analysisCount: 0,
                autoAlignments: 0,
                mergedCount: 0,
                hybridComparisons: 0,
                mergeVisualizations: 0,
                intelligentMerges: 0 // 🔴 ДОБАВЛЕНО
            }
        };

        this.userSessions.set(userId, session);
        this.activeSessions.set(sessionId, session);
        this.stats.totalSessions++;

        console.log(`🔄 Создана сессия "${name}" для пользователя ${userId}`);
        if (session.useHybrid) {
            console.log(`   🎯 Гибридный режим: ВКЛЮЧЕН`);
        }
        if (session.useIntelligentMerge) {
            console.log(`   🧠 Интеллектуальное слияние: ВКЛЮЧЕНО`);
        }

        return session;
    }

    // 4. ПОЛУЧИТЬ АКТИВНУЮ СЕССИЮ ПОЛЬЗОВАТЕЛЯ
    getActiveSession(userId) {
        return this.userSessions.get(userId);
    }

    // 5. ДОБАВИТЬ ФОТО В СЕССИЮ С АВТОСОВМЕЩЕНИЕМ (ОБНОВЛЕННЫЙ С ИНТЕЛЛЕКТУАЛЬНЫМ СЛИЯНИЕМ)
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        const session = this.getActiveSession(userId);

        if (!session) {
            console.log(`⚠️ У пользователя ${userId} нет активной сессии`);
            return {
                success: false,
                error: 'No active session',
                action: 'created_new_footprint'
            };
        }

        session.lastActivity = new Date();
        session.stats.photoCount++;

        console.log(`📸 Добавляю фото в сессию "${session.name}"...`);
        console.log(`   Предсказаний: ${analysis.predictions?.length || 0}`);

        // Обновить информацию о фото
        const photoRecord = {
            id: `photo_${Date.now()}`,
            timestamp: new Date(),
            predictionsCount: analysis.predictions?.length || 0,
            ...photoInfo
        };

        session.photos.push(photoRecord);

        // Создать временный отпечаток из этого фото
        const tempFootprint = new SimpleFootprint({
            name: `Фото_${session.photos.length}`,
            userId: userId
        });

        // Если в сессии включен гибридный режим, добавить гибридный отпечаток
        if (session.useHybrid) {
            try {
                const hybrid = new HybridFootprint({
                    id: tempFootprint.id,
                    name: tempFootprint.name,
                    userId: userId
                });
                tempFootprint.setHybridFootprint(hybrid);
            } catch (error) {
                console.log('⚠️ Не удалось создать гибридный отпечаток:', error.message);
            }
        }

        const addResult = tempFootprint.addAnalysis(analysis, {
            ...photoInfo,
            sessionId: session.id,
            photoIndex: session.photos.length
        });

        if (!addResult.success || tempFootprint.graph.nodes.size < 3) {
            console.log(`⚠️ Не удалось создать отпечаток из фото: ${addResult.error}`);
            session.analyses.push({
                ...photoRecord,
                success: false,
                error: addResult.error
            });

            return {
                success: false,
                error: addResult.error,
                nodesAdded: 0
            };
        }

        console.log(`✅ Создан временный отпечаток: ${tempFootprint.graph.nodes.size} узлов`);
        if (tempFootprint.hybridFootprint) {
            console.log(`   🎯 Создан гибридный отпечаток`);
        }

        // АВТОСОВМЕЩЕНИЕ С ИНТЕЛЛЕКТУАЛЬНЫМ СЛИЯНИЕМ
        let alignmentResult = null;
        let mergeResult = null;
        let mergeVisualizationPath = null;
        let mergeVisualizationStats = null;

        if (this.config.autoAlignment && session.currentFootprint) {
            console.log(`🎯 Запускаю автосовмещение...`);

            // Сравнить с текущим отпечатком в сессии
            const comparison = session.currentFootprint.compare(tempFootprint);

            if (tempFootprint.hybridFootprint && session.currentFootprint.hybridFootprint) {
                session.stats.hybridComparisons++;
            }

            if (comparison.decision === 'same') {
                console.log(`✅ Автосовмещение: тот же след (similarity: ${comparison.similarity})`);

                // 🔴 ВЫБОР МЕТОДА СЛИЯНИЯ
                if (session.useIntelligentMerge && session.currentFootprint.hybridFootprint && tempFootprint.hybridFootprint) {
                    // ИСПОЛЬЗУЕМ ИНТЕЛЛЕКТУАЛЬНОЕ СЛИЯНИЕ
                    console.log('🧠 Использую интеллектуальное слияние...');
                   
                    // Находим трансформацию
                    const hybridComparison = session.currentFootprint.hybridFootprint.compare(
                        tempFootprint.hybridFootprint
                    );

                    // Выполняем интеллектуальное слияние
                    mergeResult = session.currentFootprint.hybridFootprint.mergeWithTransformation(
                        tempFootprint.hybridFootprint
                    );

                    if (mergeResult.success) {
                        session.stats.intelligentMerges++;
                        this.stats.intelligentMerges++;
                    }
                } else {
                    // Классическое слияние
                    console.log('📊 Использую классическое слияние...');
                    mergeResult = session.currentFootprint.merge(tempFootprint);
                }

                if (mergeResult.success) {
                    session.stats.autoAlignments++;
                    session.stats.mergedCount += mergeResult.mergedPhotos || 0;

                    alignmentResult = {
                        success: true,
                        similarity: comparison.similarity,
                        decision: mergeResult.transformation ? 'merged_intelligently' : 'merged',
                        mergedNodes: mergeResult.mergedPoints || mergeResult.mergedPhotos || mergeResult.mergedPoints,
                        totalNodes: session.currentFootprint.graph.nodes.size,
                        method: comparison.method || (mergeResult.transformation ? 'hybrid_with_transform' : 'graph'),
                        mergeStats: mergeResult.stats || null,
                        transformation: mergeResult.transformation || null
                    };

                    // 🔴 СОЗДАЁМ ВИЗУАЛИЗАЦИЮ ИНТЕЛЛЕКТУАЛЬНОГО СЛИЯНИЯ
                    if (this.config.enableMergeVisualization) {
                        try {
                            const timestamp = Date.now();
                            let vizFilename, vizTitle;
                           
                            if (mergeResult.transformation) {
                                vizFilename = `intelligent_merge_${session.id.slice(0, 8)}_${timestamp}.png`;
                                vizTitle = 'ИНТЕЛЛЕКТУАЛЬНОЕ АВТООБЪЕДИНЕНИЕ';
                            } else {
                                vizFilename = `classic_merge_${session.id.slice(0, 8)}_${timestamp}.png`;
                                vizTitle = 'КЛАССИЧЕСКОЕ ОБЪЕДИНЕНИЕ';
                            }
                           
                            const vizPath = path.join(this.config.dbPath, 'merge_visualizations', vizFilename);

                            // Выбираем метод визуализации
                            let vizResult;
                            if (mergeResult.transformation) {
                                // Интеллектуальная визуализация
                                vizResult = await this.mergeVisualizer.visualizeIntelligentMerge(
                                    session.currentFootprint,
                                    tempFootprint,
                                    comparison,
                                    {
                                        outputPath: vizPath,
                                        title: vizTitle,
                                        showTransformation: true,
                                        showStats: true
                                    }
                                );
                            } else {
                                // Классическая визуализация
                                vizResult = await this.mergeVisualizer.visualizeMergeEnhanced(
                                    session.currentFootprint,
                                    tempFootprint,
                                    comparison,
                                    {
                                        outputPath: vizPath,
                                        title: vizTitle,
                                        showTransformation: false,
                                        showStats: true
                                    }
                                );
                            }

                            mergeVisualizationPath = vizPath;
                            mergeVisualizationStats = vizResult?.stats;
                            session.stats.mergeVisualizations++;
                            this.stats.mergeVisualizations++;

                            console.log(`🎨 Визуализация создана: ${vizPath}`);
                            console.log(`   📊 Эффективность: ${vizResult?.stats?.reductionPercent || 0}% сокращение`);

                        } catch (vizError) {
                            console.log('⚠️ Не удалось создать визуализацию:', vizError.message);
                        }
                    }

                    // 🔴 ОТПРАВКА ВИЗУАЛИЗАЦИИ В TELEGRAM
                    if (bot && chatId && mergeVisualizationPath && fs.existsSync(mergeVisualizationPath)) {
                        setTimeout(async () => {
                            try {
                                let caption;
                                if (mergeResult.transformation) {
                                    caption = this.mergeVisualizer.createIntelligentMergeCaption(
                                        session.currentFootprint,
                                        tempFootprint,
                                        mergeVisualizationStats || {
                                            points1: session.currentFootprint.graph.nodes.size,
                                            points2: tempFootprint.graph.nodes.size,
                                            matchesCount: mergeResult.mergeResult?.matches?.length || 0,
                                            mergedPoints: mergeResult.mergedPoints || 0,
                                            reductionPercent: mergeResult.stats?.efficiency || '0%',
                                            confidenceImprovement: '0%'
                                        }
                                    );
                                } else {
                                    caption = this.mergeVisualizer.createMergeCaption(
                                        session.currentFootprint,
                                        tempFootprint,
                                        mergeVisualizationStats || {
                                            points1: session.currentFootprint.graph.nodes.size,
                                            points2: tempFootprint.graph.nodes.size,
                                            matches: mergeResult.mergedPhotos || 0,
                                            matchRate: '0%',
                                            similarity: comparison.similarity,
                                            decision: comparison.decision
                                        }
                                    );
                                }

                                await bot.sendPhoto(chatId, mergeVisualizationPath, {
                                    caption: caption,
                                    parse_mode: 'HTML'
                                });

                                console.log(`✅ Визуализация объединения отправлена в чат ${chatId}`);

                            } catch (sendError) {
                                console.log('⚠️ Не удалось отправить визуализацию:', sendError.message);
                            }
                        }, 500);
                    }
                }
            } else {
                console.log(`⚠️ Автосовмещение: другой след (similarity: ${comparison.similarity})`);

                alignmentResult = {
                    success: false,
                    similarity: comparison.similarity,
                    decision: comparison.decision,
                    reason: comparison.reason,
                    method: comparison.method || 'graph'
                };

                // Создать новый отпечаток в сессии
                session.currentFootprint = tempFootprint;
            }
        } else {
            // Первое фото в сессии или автосовмещение выключено
            session.currentFootprint = tempFootprint;
            console.log(`📌 Установлен текущий отпечаток сессии`);
        }

        // Сохранить анализ
        session.analyses.push({
            ...photoRecord,
            success: true,
            nodesAdded: addResult.added,
            totalNodes: tempFootprint.graph.nodes.size,
            alignment: alignmentResult,
            footprintId: session.currentFootprint?.id,
            mergeVisualization: mergeVisualizationPath,
            mergeMethod: mergeResult?.transformation ? 'intelligent' : 'classic' // 🔴 ДОБАВЛЕНО
        });

        session.stats.analysisCount++;

        const result = {
            success: true,
            nodesAdded: addResult.added,
            totalNodes: session.currentFootprint?.graph?.nodes?.size || 0,
            alignment: alignmentResult,
            sessionStats: session.stats,
            hasHybrid: tempFootprint.hybridFootprint !== null,
            mergeVisualization: mergeVisualizationPath,
            mergeStats: mergeVisualizationStats,
            mergeMethod: mergeResult?.transformation ? 'intelligent' : 'classic' // 🔴 ДОБАВЛЕНО
        };

        // Автосохранение
        if (this.config.autoSave && session.currentFootprint) {
            this.autoSaveSession(session);
        }

        return result;
    }

    // 6. АВТОСОХРАНЕНИЕ СЕССИИ
    autoSaveSession(session) {
        if (!session.currentFootprint) return;

        try {
            const filename = `autosave_${session.id}_${Date.now()}.json`;
            const filePath = path.join(this.config.dbPath, filename);

            const data = session.currentFootprint.toJSON();
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

            if (this.config.debug) {
                console.log(`💾 Автосохранение: ${filename} (${data.graph.nodes.length} узлов)`);
                if (data.hybridFootprint) {
                    console.log(`   🎯 С гибридными признаками`);
                }
            }
        } catch (error) {
            console.log(`⚠️ Ошибка автосохранения: ${error.message}`);
        }
    }

    // 7. СОХРАНИТЬ СЕССИЮ КАК МОДЕЛЬ
    saveSessionAsModel(userId, modelName = null) {
        const session = this.getActiveSession(userId);

        if (!session || !session.currentFootprint) {
            return {
                success: false,
                error: 'Нет активной сессии или отпечатка'
            };
        }

        if (session.currentFootprint.graph.nodes.size < 5) {
            return {
                success: false,
                error: 'Слишком мало узлов для сохранения (минимум 5)'
            };
        }

        // Обновить имя модели
        const name = modelName || session.name;
        session.currentFootprint.name = name;
        session.currentFootprint.metadata.lastUpdated = new Date();

        // Сохранить модель
        const saveResult = this.saveModel(session.currentFootprint);

        if (!saveResult.success) {
            return saveResult;
        }

        // Закрыть сессию
        this.endSession(userId, 'saved_as_model');

        return {
            success: true,
            modelId: saveResult.modelId,
            modelName: name,
            modelStats: {
                nodes: session.currentFootprint.graph.nodes.size,
                edges: session.currentFootprint.graph.edges.size,
                confidence: session.currentFootprint.stats.confidence,
                photos: session.currentFootprint.metadata.totalPhotos,
                hasHybrid: session.currentFootprint.hybridFootprint !== null
            },
            sessionInfo: {
                photos: session.photos.length,
                analyses: session.analyses.length,
                autoAlignments: session.stats.autoAlignments,
                hybridComparisons: session.stats.hybridComparisons,
                mergeVisualizations: session.stats.mergeVisualizations,
                intelligentMerges: session.stats.intelligentMerges // 🔴 ДОБАВЛЕНО
            }
        };
    }

    // 8. СОХРАНИТЬ МОДЕЛЬ В БАЗУ
    saveModel(footprint) {
        try {
            if (!footprint.id || !footprint.userId) {
                return {
                    success: false,
                    error: 'Невалидный отпечаток (нет ID или userId)'
                };
            }

            const filename = `${footprint.id}.json`;
            const filePath = path.join(this.config.dbPath, filename);

            // Преобразовать в JSON
            const data = footprint.toJSON();

            // Сохранить файл
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

            // Обновить кэш
            this.modelCache.set(footprint.id, footprint);

            // Обновить пользовательский индекс
            if (!this.userModels.has(footprint.userId)) {
                this.userModels.set(footprint.userId, []);
            }

            // Проверить, нет ли уже этой модели
            const userModels = this.userModels.get(footprint.userId);
            const existingIndex = userModels.findIndex(m => m.id === footprint.id);

            if (existingIndex >= 0) {
                userModels[existingIndex] = footprint;
            } else {
                userModels.push(footprint);
            }

            // Обновить статистику
            this.stats.totalModels = this.modelCache.size;
            if (footprint.hybridFootprint) {
                this.stats.hybridModels++;
            }

            // Обновить индексный файл
            this.updateIndexFile();

            console.log(`💾 Модель сохранена: ${footprint.name} (${footprint.id})`);
            if (footprint.hybridFootprint) {
                console.log(`   🎯 С гибридными признаками`);
            }

            return {
                success: true,
                modelId: footprint.id,
                filename: filename,
                path: filePath,
                stats: {
                    nodes: footprint.graph.nodes.size,
                    edges: footprint.graph.edges.size,
                    confidence: footprint.stats.confidence,
                    hasHybrid: footprint.hybridFootprint !== null
                }
            };

        } catch (error) {
            console.log(`❌ Ошибка сохранения модели: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 9. ОБНОВИТЬ ИНДЕКСНЫЙ ФАЙЛ
    updateIndexFile() {
        try {
            const indexPath = path.join(this.config.dbPath, '_index.json');

            const index = {
                version: '1.1',
                updated: new Date().toISOString(),
                totalModels: this.modelCache.size,
                hybridModels: this.stats.hybridModels,
                totalUsers: this.userModels.size,
                mergeVisualizations: this.stats.mergeVisualizations,
                intelligentMerges: this.stats.intelligentMerges, // 🔴 ДОБАВЛЕНО
                users: {},
                stats: this.stats
            };

            // Добавить статистику по пользователям
            this.userModels.forEach((models, userId) => {
                const hybridModels = models.filter(m => m.hybridFootprint).length;
                index.users[userId] = {
                    modelCount: models.length,
                    hybridModels: hybridModels,
                    lastModel: models[models.length - 1]?.metadata?.lastUpdated || null
                };
            });

            fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

        } catch (error) {
            console.log(`⚠️ Ошибка обновления индекса: ${error.message}`);
        }
    }

    // 10. ЗАВЕРШИТЬ СЕССИЮ
    endSession(userId, reason = 'user_request') {
        const session = this.getActiveSession(userId);

        if (!session) {
            return {
                success: false,
                error: 'Нет активной сессии'
            };
        }

        const endTime = new Date();
        const duration = endTime - session.startTime;

        // Закрыть сессию
        session.status = 'ended';
        session.endTime = endTime;
        session.endReason = reason;
        session.duration = duration;

        // Удалить из активных сессий
        this.activeSessions.delete(session.id);
        this.userSessions.delete(userId);

        console.log(`🏁 Сессия "${session.name}" завершена`);
        console.log(`   Причина: ${reason}`);
        console.log(`   Длительность: ${Math.round(duration / 1000)} сек`);
        console.log(`   Фото: ${session.photos.length}`);
        console.log(`   Анализов: ${session.analyses.length}`);
        console.log(`   Гибридных сравнений: ${session.stats.hybridComparisons}`);
        console.log(`   Визуализаций объединения: ${session.stats.mergeVisualizations}`);
        console.log(`   Интеллектуальных слияний: ${session.stats.intelligentMerges}`); // 🔴 ДОБАВЛЕНО

        return {
            success: true,
            sessionId: session.id,
            duration: duration,
            stats: session.stats,
            currentFootprint: session.currentFootprint ? {
                id: session.currentFootprint.id,
                name: session.currentFootprint.name,
                nodes: session.currentFootprint.graph.nodes.size,
                confidence: session.currentFootprint.stats.confidence,
                hasHybrid: session.currentFootprint.hybridFootprint !== null
            } : null
        };
    }

    // 11. ПОЛУЧИТЬ МОДЕЛИ ПОЛЬЗОВАТЕЛЯ
    getUserModels(userId) {
        return this.userModels.get(userId) || [];
    }

    // 12. НАЙТИ ПОХОЖИЕ МОДЕЛИ
    findSimilarModels(targetFootprint, userId = null, options = {}) {
        console.log(`🔎 Ищу похожие модели для "${targetFootprint.name}"...`);

        // ПРОВЕРКА: Если у целевого отпечатка есть гибридные признаки, использовать гибридный поиск
        if (this.config.useHybridMode && targetFootprint.hybridFootprint &&
            targetFootprint.hybridFootprint.bitmask && targetFootprint.hybridFootprint.moments) {

            console.log('🎯 Использую гибридный поиск...');
            return this.findSimilarHybrid(targetFootprint, userId, options);
        }

        // Классический поиск по графам
        console.log('📊 Использую классический поиск по графам...');
        return this.findSimilarGraphBased(targetFootprint, userId, options);
    }

    // 12a. ГИБРИДНЫЙ ПОИСК - КАСКАДНЫЙ
    async findSimilarHybrid(targetFootprint, userId = null, options = {}) {
        console.log('🎯 Запускаю каскадный гибридный поиск...');
        this.stats.hybridSearches++;

        // Определить какие модели сравнивать
        let modelsToCompare = [];

        if (userId) {
            // Искать среди моделей конкретного пользователя
            modelsToCompare = this.getUserModels(userId);
        } else {
            // Искать среди всех моделей
            modelsToCompare = Array.from(this.modelCache.values());
        }

        // Исключить целевую модель и модели без гибридных признаков
        modelsToCompare = modelsToCompare.filter(model =>
            model.id !== targetFootprint.id &&
            model.hybridFootprint !== null &&
            model.hybridFootprint.bitmask !== null
        );

        if (modelsToCompare.length === 0) {
            console.log('⚠️ Нет моделей с гибридными признаками для сравнения');
            return {
                success: false,
                error: 'Нет моделей с гибридными признаками для сравнения',
                similarCount: 0
            };
        }

        console.log(`   Сравниваю с ${modelsToCompare.length} моделями с гибридными признаками...`);

        // ШАГ 1: Быстрый поиск по битовым маскам
        console.log('   1️⃣ Быстрый поиск по битовым маскам...');
        const bitmaskCandidates = HybridFootprint.fastSearch(
            targetFootprint.hybridFootprint.bitmask.bitmask,
            modelsToCompare.map(m => ({
                item: m,
                bitmask: m.hybridFootprint.bitmask.bitmask
            })),
            options.maxBitmaskDistance || 25
        );

        console.log(`      Найдено ${bitmaskCandidates.length} кандидатов по битовой маске`);

        if (bitmaskCandidates.length === 0) {
            return {
                success: true,
                targetModel: {
                    id: targetFootprint.id,
                    name: targetFootprint.name,
                    nodes: targetFootprint.graph.nodes.size
                },
                similarModels: [],
                totalCompared: modelsToCompare.length,
                similarCount: 0,
                method: 'hybrid',
                searchSteps: {
                    bitmask: 0,
                    moments: 0,
                    final: 0
                }
            };
        }

        // ШАГ 2: Уточнить по моментам
        console.log(`   2️⃣ Уточнение по моментам (${bitmaskCandidates.length} кандидатов)...`);
        const momentCandidates = bitmaskCandidates
            .map(candidate => ({
                ...candidate,
                momentResult: targetFootprint.hybridFootprint.moments.compare(
                    candidate.item.hybridFootprint.moments
                )
            }))
            .filter(c => c.momentResult.distance < (options.momentThreshold || 0.5))
            .slice(0, options.maxCandidates || 10);

        console.log(`      Осталось ${momentCandidates.length} кандидатов после сравнения моментов`);

        // ШАГ 3: Точное сравнение графов
        console.log(`   3️⃣ Точное сравнение графов (${momentCandidates.length} кандидатов)...`);
        const finalResults = momentCandidates.map(candidate => {
            const comparison = targetFootprint.compare(candidate.item);
            return {
                model: candidate.item,
                similarity: comparison.similarity,
                decision: comparison.decision,
                details: comparison,
                bitmaskDistance: candidate.bitmaskDistance,
                momentDistance: candidate.momentResult.distance,
                combinedScore: this.calculateCombinedScore(
                    candidate.bitmaskDistance,
                    candidate.momentResult.distance,
                    comparison.similarity
                )
            };
        })
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, options.maxResults || 5);

        // Обновить статистику
        this.stats.totalComparisons += modelsToCompare.length;
        this.stats.hybridComparisons++;

        return {
            success: true,
            targetModel: {
                id: targetFootprint.id,
                name: targetFootprint.name,
                nodes: targetFootprint.graph.nodes.size,
                hasHybrid: true
            },
            similarModels: finalResults,
            totalCompared: modelsToCompare.length,
            similarCount: finalResults.length,
            method: 'hybrid',
            searchSteps: {
                bitmask: bitmaskCandidates.length,
                moments: momentCandidates.length,
                final: finalResults.length
            },
            stats: {
                avgBitmaskDistance: finalResults.reduce((sum, r) => sum + r.bitmaskDistance, 0) / finalResults.length || 0,
                avgMomentDistance: finalResults.reduce((sum, r) => sum + r.momentDistance, 0) / finalResults.length || 0
            }
        };
    }

    // 12b. КЛАССИЧЕСКИЙ ПОИСК ПО ГРАФАМ
    findSimilarGraphBased(targetFootprint, userId = null, options = {}) {
        // Определить какие модели сравнивать
        let modelsToCompare = [];

        if (userId) {
            // Искать среди моделей конкретного пользователя
            modelsToCompare = this.getUserModels(userId);
        } else {
            // Искать среди всех моделей
            modelsToCompare = Array.from(this.modelCache.values());
        }

        // Исключить целевую модель
        modelsToCompare = modelsToCompare.filter(model =>
            model.id !== targetFootprint.id
        );

        if (modelsToCompare.length === 0) {
            return {
                success: false,
                error: 'Нет моделей для сравнения',
                similarCount: 0
            };
        }

        console.log(`   Сравниваю с ${modelsToCompare.length} моделями...`);

        // Использовать матчер для поиска похожих
        const searchResult = this.matcher.findMostSimilar(
            targetFootprint.graph,
            modelsToCompare.map(m => m.graph),
            options.maxResults || 10
        );

        // Преобразовать результаты
        const similarModels = searchResult.bestMatches
            .filter(match => match.decision === 'same' || match.decision === 'similar')
            .map(match => {
                const model = modelsToCompare[match.index];
                return {
                    model: model,
                    similarity: match.similarity,
                    decision: match.decision,
                    reason: match.reason,
                    confidence: match.confidence,
                    comparison: this.compareFootprints(targetFootprint, model)
                };
            });

        // Обновить статистику
        this.stats.totalComparisons += modelsToCompare.length;

        return {
            success: true,
            targetModel: {
                id: targetFootprint.id,
                name: targetFootprint.name,
                nodes: targetFootprint.graph.nodes.size
            },
            similarModels: similarModels,
            totalCompared: modelsToCompare.length,
            similarCount: similarModels.length,
            method: 'graph',
            stats: searchResult.stats,
            searchTime: searchResult.searchTime
        };
    }

    // 13. СРАВНИТЬ ДВА ОТПЕЧАТКА
    compareFootprints(fp1, fp2) {
        return fp1.compare(fp2);
    }

    // 14. ПОЛУЧИТЬ СТАТИСТИКУ СИСТЕМЫ - ОБНОВЛЕННЫЙ
    getSystemStats() {
        const now = new Date();
        const uptime = now - this.stats.startedAt;

        return {
            system: {
                started: this.stats.startedAt.toLocaleString('ru-RU'),
                uptime: Math.round(uptime / 1000),
                version: '1.1'
            },
            storage: {
                totalModels: this.stats.totalModels,
                hybridModels: this.stats.hybridModels,
                totalUsers: this.userModels.size,
                activeSessions: this.activeSessions.size,
                modelCache: this.modelCache.size,
                mergeVisualizations: this.stats.mergeVisualizations,
                intelligentMerges: this.stats.intelligentMerges // 🔴 ДОБАВЛЕНО
            },
            performance: {
                totalSessions: this.stats.totalSessions,
                totalComparisons: this.stats.totalComparisons,
                successfulAlignments: this.stats.successfulAlignments,
                hybridComparisons: this.stats.hybridComparisons,
                hybridSearches: this.stats.hybridSearches,
                mergeVisualizations: this.stats.mergeVisualizations,
                intelligentMerges: this.stats.intelligentMerges, // 🔴 ДОБАВЛЕНО
                matcherStats: this.matcher.getStats()
            },
            config: {
                dbPath: this.config.dbPath,
                autoAlignment: this.config.autoAlignment,
                autoSave: this.config.autoSave,
                useHybridMode: this.config.useHybridMode,
                hybridSearchThreshold: this.config.hybridSearchThreshold,
                enableMergeVisualization: this.config.enableMergeVisualization,
                enableIntelligentMerge: this.config.enableIntelligentMerge, // 🔴 ДОБАВЛЕНО
                debug: this.config.debug
            }
        };
    }

    // 15. ПОЛУЧИТЬ МОДЕЛЬ ПО ID
    getModelById(modelId) {
        return this.modelCache.get(modelId) || null;
    }

    // 16. УДАЛИТЬ МОДЕЛЬ
    deleteModel(modelId, userId = null) {
        try {
            const model = this.getModelById(modelId);

            if (!model) {
                return {
                    success: false,
                    error: 'Модель не найдена'
                };
            }

            // Проверить права (если указан userId)
            if (userId && model.userId !== userId) {
                return {
                    success: false,
                    error: 'Нет прав на удаление этой модели'
                };
            }

            // Удалить файл
            const filePath = path.join(this.config.dbPath, `${modelId}.json`);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            // Удалить из кэша
            this.modelCache.delete(modelId);

            // Удалить из пользовательского индекса
            if (model.userId && this.userModels.has(model.userId)) {
                const userModels = this.userModels.get(model.userId);
                const index = userModels.findIndex(m => m.id === modelId);
                if (index >= 0) {
                    userModels.splice(index, 1);
                }
            }

            // Обновить статистику
            this.stats.totalModels = this.modelCache.size;
            if (model.hybridFootprint) {
                this.stats.hybridModels = Math.max(0, this.stats.hybridModels - 1);
            }
            this.updateIndexFile();

            console.log(`🗑️ Модель удалена: ${model.name} (${modelId})`);
            if (model.hybridFootprint) {
                console.log(`   🎯 Удалена гибридная модель`);
            }

            return {
                success: true,
                modelId: modelId,
                modelName: model.name
            };

        } catch (error) {
            console.log(`❌ Ошибка удаления модели: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 17. ЭКСПОРТ МОДЕЛИ ДЛЯ ОБМЕНА
    exportModel(modelId, format = 'json') {
        const model = this.getModelById(modelId);

        if (!model) {
            return {
                success: false,
                error: 'Модель не найдена'
            };
        }

        if (format === 'json') {
            return {
                success: true,
                format: 'json',
                data: model.toJSON(),
                filename: `${model.name}_${modelId}.json`
            };
        } else {
            return {
                success: false,
                error: `Формат ${format} не поддерживается`
            };
        }
    }

    // 18. ОЧИСТКА СТАРЫХ АВТОСОХРАНЕНИЙ
    cleanupOldAutosaves(maxAgeHours = 24) {
        try {
            if (!fs.existsSync(this.config.dbPath)) return;

            const files = fs.readdirSync(this.config.dbPath);
            const autosaveFiles = files.filter(f => f.startsWith('autosave_'));

            let deleted = 0;
            const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);

            autosaveFiles.forEach(filename => {
                const filePath = path.join(this.config.dbPath, filename);
                const stats = fs.statSync(filePath);

                if (stats.mtimeMs < cutoffTime) {
                    fs.unlinkSync(filePath);
                    deleted++;

                    if (this.config.debug) {
                        console.log(`🧹 Удалено старое автосохранение: ${filename}`);
                    }
                }
            });

            if (deleted > 0) {
                console.log(`🧹 Очистка: удалено ${deleted} старых автосохранений`);
            }

            return {
                success: true,
                deleted: deleted,
                totalChecked: autosaveFiles.length
            };

        } catch (error) {
            console.log(`⚠️ Ошибка очистка автосохранений: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 19. ИНИЦИАЛИЗАЦИЯ ВИЗУАЛИЗАТОРА
    initializeVisualizer() {
        try {
            const GraphVisualizer = require('./graph-visualizer');
            this.graphVisualizer = new GraphVisualizer({
                debug: this.config.debug,
                outputDir: path.join(this.config.dbPath, 'visualizations')
            });
            console.log('🎨 GraphVisualizer инициализирован');
        } catch (error) {
            console.log('⚠️ Не удалось инициализировать GraphVisualizer:', error.message);
        }
    }

    // 20. ВИЗУАЛИЗАЦИЯ СРАВНЕНИЯ МОДЕЛЕЙ
    async visualizeComparison(modelId1, modelId2) {
        try {
            if (!this.graphVisualizer) {
                this.initializeVisualizer();
            }

            const model1 = this.getModelById(modelId1);
            const model2 = this.getModelById(modelId2);

            if (!model1 || !model2) {
                return { success: false, error: 'Модели не найдены' };
            }

            // Сравниваем модели
            const comparison = model1.compare(model2);

            // Создаём визуализацию
                const vizPath = await this.graphVisualizer.visualizeComparison(
                    model1.graph,
                    model2.graph,
                    comparison,
                    {
                        filename: `compare_${modelId1.slice(0, 8)}_${modelId2.slice(0, 8)}.png`
                    }
                );

                return {
                    success: true,
                    visualization: vizPath,
                    comparison: comparison
                };

            } catch (error) {
                console.log('❌ Ошибка визуализации сравнения:', error);
                return { success: false, error: error.message };
            }
        }

        // 21. ВИЗУАЛИЗАЦИЯ СЕССИИ
        async visualizeSession(userId) {
            try {
                if (!this.graphVisualizer) {
                    this.initializeVisualizer();
                }

                const session = this.getActiveSession(userId);
                if (!session) {
                    return { success: false, error: 'Нет активной сессии' };
                }

                const vizPath = await this.graphVisualizer.visualizeSessionHistory(session, {
                    filename: `session_${session.id.slice(0, 8)}.png`
                });

                return {
                    success: true,
                    visualization: vizPath,
                    sessionId: session.id
                };

            } catch (error) {
                console.log('❌ Ошибка визуализации сессии:', error);
                return { success: false, error: error.message };
            }
        }

        // 22. ВИЗУАЛИЗАЦИЯ МОДЕЛИ
        async visualizeModel(modelId) {
            try {
                const model = this.getModelById(modelId);
                if (!model) {
                    return { success: false, error: 'Модель не найдена' };
                }

                const vizPath = await model.visualizeGraph();

                return {
                    success: true,
                    visualization: vizPath,
                    model: {
                        id: model.id,
                        name: model.name,
                        stats: model.getInfo()
                    }
                };

            } catch (error) {
                console.log('❌ Ошибка визуализации модели:', error);
                return { success: false, error: error.message };
            }
        }

        // 23. РАССЧИТАТЬ КОМБИНИРОВАННЫЙ SCORE ДЛЯ ГИБРИДНОГО ПОИСКА
        calculateCombinedScore(bitmaskDistance, momentDistance, graphSimilarity) {
            // Нормализовать расстояния в схожести (1 = идеально, 0 = плохо)
            const bitmaskSimilarity = 1 - (bitmaskDistance / 100); // bitmaskDistance от 0 до ~100
            const momentSimilarity = 1 - momentDistance; // momentDistance от 0 до 1

            // Взвешенное среднее
            return (bitmaskSimilarity * 0.3 + momentSimilarity * 0.3 + graphSimilarity * 0.4);
        }

        // 24. ПОИСК С ИСПОЛЬЗОВАНИЕМ ТОЛЬКО ГИБРИДНЫХ ПРИЗНАКОВ
        async findSimilarHybridOnly(hybridFootprint, userId = null, options = {}) {
            if (!hybridFootprint || !hybridFootprint.bitmask || !hybridFootprint.moments) {
                return { success: false, error: 'Недостаточно гибридных признаков' };
            }

            console.log('🎯 Запускаю поиск только по гибридным признакам...');
            this.stats.hybridSearches++;

            // Определить какие модели сравнивать
            let modelsToCompare = [];

            if (userId) {
                modelsToCompare = this.getUserModels(userId);
            } else {
                modelsToCompare = Array.from(this.modelCache.values());
            }

            // Фильтровать модели с гибридными признаками
            modelsToCompare = modelsToCompare.filter(model =>
                model.hybridFootprint !== null &&
                model.hybridFootprint.bitmask !== null &&
                model.hybridFootprint.moments !== null
            );

            if (modelsToCompare.length === 0) {
                return {
                    success: false,
                    error: 'Нет моделей с гибридными признаками',
                    similarCount: 0
                };
            }

            console.log(`   Сравниваю с ${modelsToCompare.length} гибридными моделями...`);

            // Быстрый поиск по битовым маскам
            const bitmaskCandidates = HybridFootprint.fastSearch(
                hybridFootprint.bitmask.bitmask,
                modelsToCompare.map(m => ({
                    item: m,
                    bitmask: m.hybridFootprint.bitmask.bitmask
                })),
                options.maxBitmaskDistance || 30
            );

            // Сравнение моментов и графов
            const results = bitmaskCandidates
                .map(candidate => {
                    const momentResult = hybridFootprint.moments.compare(
                        candidate.item.hybridFootprint.moments
                    );
                    const graphComparison = candidate.item.compare;

                    return {
                        model: candidate.item,
                        bitmaskDistance: candidate.bitmaskDistance,
                        momentDistance: momentResult.distance,
                        momentSimilarity: 1 - momentResult.distance,
                        combinedScore: this.calculateCombinedScore(
                            candidate.bitmaskDistance,
                            momentResult.distance,
                            0.5 // базовое значение для графа
                        )
                    };
                })
                .filter(r => r.momentDistance < (options.momentThreshold || 0.6))
                .sort((a, b) => b.combinedScore - a.combinedScore)
                .slice(0, options.maxResults || 10);

            return {
                success: true,
                similarModels: results,
                totalCompared: modelsToCompare.length,
                similarCount: results.length,
                method: 'hybrid-only'
            };
        }

        // 🔴 25. НОВЫЙ МЕТОД: СОЗДАТЬ ВИЗУАЛИЗАЦИЮ ОБЪЕДИНЕНИЯ ДЛЯ СУЩЕСТВУЮЩИХ МОДЕЛЕЙ
        async createMergeVisualization(modelId1, modelId2, outputPath = null) {
            try {
                const model1 = this.getModelById(modelId1);
                const model2 = this.getModelById(modelId2);

                if (!model1 || !model2) {
                    return { success: false, error: 'Модели не найдены' };
                }

                // Сравниваем модели
                const comparison = model1.compare(model2);

                // Создаем визуализацию
                const timestamp = Date.now();
                const defaultPath = outputPath || path.join(this.config.dbPath, 'merge_visualizations', `merge_${modelId1}_${modelId2}_${timestamp}.png`);

                const vizResult = this.mergeVisualizer.visualizeMerge(
                    model1,
                    model2,
                    comparison,
                    defaultPath
                );

                this.stats.mergeVisualizations++;

                return {
                    success: true,
                    visualizationPath: defaultPath,
                    comparison: comparison,
                    stats: vizResult.stats,
                    caption: this.mergeVisualizer.createMergeCaption(model1, model2, vizResult.stats)
                };

            } catch (error) {
                console.log('❌ Ошибка создания визуализации объединения:', error);
                return { success: false, error: error.message };
            }
        }

        // 🔴 26. НОВЫЙ МЕТОД: СОЗДАТЬ ИНТЕЛЛЕКТУАЛЬНУЮ ВИЗУАЛИЗАЦИЮ ОБЪЕДИНЕНИЯ
        async createIntelligentMergeVisualization(modelId1, modelId2, outputPath = null) {
            try {
                const model1 = this.getModelById(modelId1);
                const model2 = this.getModelById(modelId2);

                if (!model1 || !model2) {
                    return { success: false, error: 'Модели не найдены' };
                }

                // Проверяем, есть ли гибридные отпечатки
                if (!model1.hybridFootprint || !model2.hybridFootprint) {
                    return {
                        success: false,
                        error: 'Для интеллектуального слияния нужны гибридные отпечатки'
                    };
                }

                // Сравниваем модели
                const comparison = model1.hybridFootprint.compare(model2.hybridFootprint);

                // Создаем интеллектуальную визуализацию
                const timestamp = Date.now();
                const defaultPath = outputPath || path.join(this.config.dbPath, 'merge_visualizations', `intelligent_merge_${modelId1}_${modelId2}_${timestamp}.png`);

                const vizResult = await this.mergeVisualizer.visualizeIntelligentMerge(
                    model1,
                    model2,
                    comparison,
                    {
                        outputPath: defaultPath,
                        title: 'ИНТЕЛЛЕКТУАЛЬНОЕ СЛИЯНИЕ МОДЕЛЕЙ',
                        showTransformation: true,
                        showStats: true
                    }
                );

                this.stats.mergeVisualizations++;
                this.stats.intelligentMerges++;

                return {
                    success: true,
                    visualizationPath: defaultPath,
                    comparison: comparison,
                    stats: vizResult.stats,
                    caption: this.mergeVisualizer.createIntelligentMergeCaption(model1, model2, vizResult.stats),
                    mergeResult: vizResult.mergeResult
                };

            } catch (error) {
                console.log('❌ Ошибка создания интеллектуальной визуализации:', error);
                return { success: false, error: error.message };
            }
        }

        // 🔴 27. НОВЫЙ МЕТОД: ВЫПОЛНИТЬ ИНТЕЛЛЕКТУАЛЬНОЕ СЛИЯНИЕ МОДЕЛЕЙ
        async performIntelligentMerge(modelId1, modelId2, options = {}) {
            try {
                const model1 = this.getModelById(modelId1);
                const model2 = this.getModelById(modelId2);

                if (!model1 || !model2) {
                    return { success: false, error: 'Модели не найдены' };
                }

                // Проверяем, есть ли гибридные отпечатки
                if (!model1.hybridFootprint || !model2.hybridFootprint) {
                    return {
                        success: false,
                        error: 'Для интеллектуального слияния нужны гибридные отпечатки'
                    };
                }

                console.log(`🧠 Выполняю интеллектуальное слияние моделей:`);
                console.log(`   📸 ${model1.name} (${model1.hybridFootprint.originalPoints.length} точек)`);
                console.log(`   📸 ${model2.name} (${model2.hybridFootprint.originalPoints.length} точек)`);

                // Выполняем интеллектуальное слияние
                const mergeResult = model1.hybridFootprint.mergeWithTransformation(
                    model2.hybridFootprint
                );

                if (!mergeResult.success) {
                    return mergeResult;
                }

                // Обновляем модель1
                model1.graph = model1.hybridFootprint.graph;
                model1.originalPoints = model1.hybridFootprint.originalPoints;
                model1.stats.confidence = model1.hybridFootprint.stats.confidence;
                model1.metadata.totalPhotos += model2.metadata.totalPhotos;
                model1.metadata.lastUpdated = new Date();

                // Создаем визуализацию если нужно
                let visualizationPath = null;
                if (options.createVisualization) {
                    const timestamp = Date.now();
                    const vizPath = path.join(this.config.dbPath, 'merge_visualizations',
                        `intelligent_merge_result_${modelId1}_${timestamp}.png`);

                    const vizResult = await this.mergeVisualizer.visualizeIntelligentMerge(
                        model1,
                        model2,
                        { similarity: mergeResult.confidence, decision: 'same' },
                        {
                            outputPath: vizPath,
                            title: 'РЕЗУЛЬТАТ ИНТЕЛЛЕКТУАЛЬНОГО СЛИЯНИЯ',
                            showTransformation: true,
                            showStats: true
                        }
                    );

                    visualizationPath = vizPath;
                    this.stats.mergeVisualizations++;
                }

                // Сохраняем обновленную модель
                this.saveModel(model1);

                this.stats.intelligentMerges++;

                console.log(`✅ Интеллектуальное слияние успешно выполнено!`);
                console.log(`   📊 Результат: ${mergeResult.allPoints} точек`);
                console.log(`   🔗 Слито: ${mergeResult.mergedPoints} точек`);
                console.log(`   💎 Уверенность: ${Math.round(mergeResult.confidence * 100)}%`);

                return {
                    success: true,
                    mergedModelId: modelId1,
                    stats: mergeResult.stats,
                    transformation: mergeResult.transformation,
                    visualization: visualizationPath,
                    result: {
                        totalPoints: mergeResult.allPoints,
                        mergedPoints: mergeResult.mergedPoints,
                        confidence: mergeResult.confidence,
                        efficiency: mergeResult.stats?.efficiency || 'N/A'
                    }
                };

            } catch (error) {
                console.log('❌ Ошибка интеллектуального слияния:', error);
                return { success: false, error: error.message };
            }
        }

        // 🔴 28. НОВЫЙ МЕТОД: ПОЛУЧИТЬ ВСЕ ВИЗУАЛИЗАЦИИ ОБЪЕДИНЕНИЯ
        getAllMergeVisualizations(userId = null) {
            try {
                const vizDir = path.join(this.config.dbPath, 'merge_visualizations');
                if (!fs.existsSync(vizDir)) {
                    return [];
                }

                const files = fs.readdirSync(vizDir)
                    .filter(f => f.endsWith('.png'))
                    .map(f => ({
                        filename: f,
                        path: path.join(vizDir, f),
                        size: fs.statSync(path.join(vizDir, f)).size,
                        created: fs.statSync(path.join(vizDir, f)).birthtime
                    }));

                if (userId) {
                    // Фильтровать по пользователю (если в имени файла есть userId)
                    return files.filter(f =>
                        f.filename.includes(`user_${userId}`) ||
                        f.filename.includes(`session_${userId}`)
                    );
                }

                return files;

            } catch (error) {
                console.log('⚠️ Ошибка получения визуализаций:', error.message);
                return [];
            }
        }

        // 🔴 29. НОВЫЙ МЕТОД: ПОЛУЧИТЬ СТАТИСТИКУ ИНТЕЛЛЕКТУАЛЬНЫХ СЛИЯНИЙ
        getIntelligentMergeStats(userId = null) {
            const sessions = userId
                ? [this.getActiveSession(userId)].filter(s => s)
                : Array.from(this.activeSessions.values());

            const totalIntelligentMerges = sessions.reduce((sum, session) =>
                sum + (session.stats.intelligentMerges || 0), 0);

            const totalMerges = sessions.reduce((sum, session) =>
                sum + (session.stats.autoAlignments || 0), 0);

            const intelligentMergeRate = totalMerges > 0
                ? (totalIntelligentMerges / totalMerges * 100).toFixed(1)
                : 0;

            return {
                totalIntelligentMerges,
                totalMerges,
                intelligentMergeRate: `${intelligentMergeRate}%`,
                sessionsWithIntelligentMerge: sessions.filter(s => s.stats.intelligentMerges > 0).length,
                totalSessions: sessions.length,
                systemStats: {
                    intelligentMerges: this.stats.intelligentMerges,
                    totalVisualizations: this.stats.mergeVisualizations
                }
            };
        }

        // 🔴 30. НОВЫЙ МЕТОД: ТЕСТ ИНТЕЛЛЕКТУАЛЬНОГО СЛИЯНИЯ
        async testIntelligentMerge(testPointsCount = 30) {
            console.log('🧪 Запускаю тест интеллектуального слияния...');

            // Создать два похожих отпечатка
            const points1 = [];
            const points2 = [];

            // Общие точки (70% совпадений)
            const commonPoints = Math.floor(testPointsCount * 0.7);
            for (let i = 0; i < commonPoints; i++) {
                const baseX = 100 + Math.random() * 300;
                const baseY = 100 + Math.random() * 200;

                points1.push({
                    x: baseX,
                    y: baseY,
                    confidence: 0.7 + Math.random() * 0.3
                });

                // Точки во втором отпечатке немного смещены
                points2.push({
                    x: baseX + Math.random() * 20 - 10,
                    y: baseY + Math.random() * 20 - 10,
                    confidence: 0.7 + Math.random() * 0.3
                });
            }

            // Уникальные точки (30%)
            const unique1 = Math.floor(testPointsCount * 0.15);
            for (let i = 0; i < unique1; i++) {
                points1.push({
                    x: 100 + Math.random() * 300,
                    y: 100 + Math.random() * 200,
                    confidence: 0.6 + Math.random() * 0.4
                });
            }

            const unique2 = Math.floor(testPointsCount * 0.15);
            for (let i = 0; i < unique2; i++) {
                points2.push({
                    x: 100 + Math.random() * 300,
                    y: 100 + Math.random() * 200,
                    confidence: 0.6 + Math.random() * 0.4
                });
            }

            console.log(`📊 Созданы тестовые данные:`);
            console.log(`   🟦 Отпечаток 1: ${points1.length} точек`);
            console.log(`   🟥 Отпечаток 2: ${points2.length} точек`);
            console.log(`   🔗 Ожидаемые совпадения: ~${commonPoints}`);

            // Создаем гибридные отпечатки
            const footprint1 = new HybridFootprint({ name: 'Тестовый отпечаток 1' });
            const footprint2 = new HybridFootprint({ name: 'Тестовый отпечаток 2' });

            footprint1.createFromPoints(points1);
            footprint2.createFromPoints(points2);

            // Тест интеллектуального слияния
            console.log('\n🧠 ТЕСТ ИНТЕЛЛЕКТУАЛЬНОГО СЛИЯНИЯ:');
            const mergeResult = footprint1.mergeWithTransformation(footprint2);

            if (mergeResult.success) {
                console.log(`✅ Тест успешен!`);
                console.log(`📊 Результаты:`);
                console.log(`   ├─ Всего точек до: ${points1.length + points2.length}`);
                console.log(`   ├─ Всего точек после: ${mergeResult.allPoints}`);
                console.log(`   ├─ Слито точек: ${mergeResult.mergedPoints}`);
                console.log(`   ├─ Сокращение дубликатов: ${mergeResult.stats?.efficiency || 'N/A'}`);
                console.log(`   └─ Уверенность: ${Math.round(mergeResult.confidence * 100)}%`);

                // Создаем визуализацию
                const vizPath = path.join(this.config.dbPath, 'merge_visualizations', `test_intelligent_merge_${Date.now()}.png`);
               
                await this.mergeVisualizer.visualizeIntelligentMerge(
                    { name: 'Тест 1', hybridFootprint: footprint1 },
                    { name: 'Тест 2', hybridFootprint: footprint2 },
                    { similarity: 0.8, decision: 'same' },
                    {
                        outputPath: vizPath,
                        title: 'ТЕСТ ИНТЕЛЛЕКТУАЛЬНОГО СЛИЯНИЯ',
                        showTransformation: true,
                        showStats: true
                    }
                );

                console.log(`🎨 Визуализация создана: ${vizPath}`);

                return {
                    success: true,
                    testResults: mergeResult,
                    visualization: vizPath,
                    stats: {
                        reductionPercentage: ((points1.length + points2.length - mergeResult.allPoints) /
                                            (points1.length + points2.length) * 100).toFixed(1),
                        mergedPoints: mergeResult.mergedPoints,
                        confidence: mergeResult.confidence
                    }
                };
            } else {
                console.log(`❌ Тест не удался: ${mergeResult.reason}`);
                return {
                    success: false,
                    error: mergeResult.reason
                };
            }
        }
    }

    module.exports = SimpleFootprintManager;
