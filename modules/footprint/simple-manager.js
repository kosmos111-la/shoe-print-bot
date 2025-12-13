// modules/footprint/simple-manager.js
// МЕНЕДЖЕР СИСТЕМЫ ЦИФРОВЫХ ОТПЕЧАТКОВ

const fs = require('fs');
const path = require('path');
const SimpleFootprint = require('./simple-footprint');
const SimpleGraphMatcher = require('./simple-matcher');
const HybridFootprint = require('./hybrid-footprint');
const MergeVisualizer = require('./merge-visualizer');
const TopologyMerger = require('./topology-merger');

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
            enableMergeVisualization: options.enableMergeVisualization !== false, // 🔴 КРИТИЧЕСКИ ВАЖНО
            enableIntelligentMerge: options.enableIntelligentMerge !== false,
            enableSuperModel: options.enableSuperModel !== false,
            superModelConfidenceThreshold: options.superModelConfidenceThreshold || 0.8,
            enableTopologySuperModel: options.enableTopologySuperModel !== false,
            topologySimilarityThreshold: options.topologySimilarityThreshold || 0.7,
            ...options
        };

        // Инициализация компонентов
        this.matcher = new SimpleGraphMatcher({
            debug: this.config.debug,
            enableDetailedMatch: true
        });

        // ИНИЦИАЛИЗАЦИЯ TOPOLOGY MERGER
        this.topologyMerger = new TopologyMerger({
            structuralSimilarityThreshold: this.config.topologySimilarityThreshold,
            preserveTopology: true
        });

        // ИНИЦИАЛИЗАЦИЯ ВИЗУАЛИЗАТОРА ОБЪЕДИНЕНИЙ
        this.mergeVisualizer = new MergeVisualizer();

        // Хранилища
        this.userSessions = new Map();      // userId -> session
        this.userModels = new Map();        // userId -> [footprints]
        this.activeSessions = new Map();    // sessionId -> session
        this.modelCache = new Map();        // modelId -> footprint
        this.superModels = new Map();       // userId -> [superModels]

        // Статистика
        this.stats = {
            totalSessions: 0,
            totalModels: 0,
            totalComparisons: 0,
            successfulAlignments: 0,
            hybridComparisons: 0,
            hybridSearches: 0,
            mergeVisualizations: 0,
            intelligentMerges: 0,
            superModelsCreated: 0,
            topologySuperModelsCreated: 0,
            topologicalMerges: 0,
            startedAt: new Date()
        };

        // Инициализация
        this.ensureDatabase();
        this.ensureDirectories(); // 🔴 ДОБАВЛЕНО: создание папок
        this.loadAllModels();

        console.log(`🚀 SimpleFootprintManager инициализирован`);
        console.log(`📁 База данных: ${this.config.dbPath}`);
        console.log(`🎯 Автосовмещение: ${this.config.autoAlignment ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);
        console.log(`🎯 Гибридный режим: ${this.config.useHybridMode ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
        console.log(`🎨 Визуализация объединений: ${this.config.enableMergeVisualization ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
        console.log(`🧠 Интеллектуальное слияние: ${this.config.enableIntelligentMerge ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);
        console.log(`🏗️ Топологические супер-модели: ${this.config.enableTopologySuperModel ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    }

    // 🔴 ДОБАВЛЕНО: Создание необходимых папок
    ensureDirectories() {
        try {
            const dirs = [
                path.join(this.config.dbPath, 'merge_visualizations'),
                path.join(this.config.dbPath, 'topology_supermodels'),
                './temp/merge_visualizations'
            ];

            dirs.forEach(dir => {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                    console.log(`📁 Создана папка: ${dir}`);
                }
            });
        } catch (error) {
            console.log(`⚠️ Ошибка создания папок: ${error.message}`);
        }
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
                    version: '1.3',
                    created: new Date().toISOString(),
                    totalModels: 0,
                    hybridModels: 0,
                    superModels: 0,
                    topologySuperModels: 0,
                    users: {},
                    stats: this.stats
                };
                fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
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
            let superModelsLoaded = 0;
            let topologySuperModelsLoaded = 0;

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

                        // ОПРЕДЕЛИТЬ ТИП МОДЕЛИ
                        if (footprint.name && footprint.name.includes('Топологическая супер-модель')) {
                            topologySuperModelsLoaded++;
                            if (!this.superModels.has(footprint.userId)) {
                                this.superModels.set(footprint.userId, []);
                            }
                            this.superModels.get(footprint.userId).push(footprint);
                        }
                        else if (footprint.name && footprint.name.includes('Супер-модель')) {
                            superModelsLoaded++;
                        }
                    }

                    loaded++;

                    // Подсчитать гибридные модели
                    if (footprint.hybridFootprint) {
                        hybridLoaded++;
                    }

                    if (this.config.debug && loaded <= 3) {
                        console.log(`   📦 Загружена модель: ${footprint.name} (${footprint.graph.nodes.size} узлов)`);
                        if (footprint.hybridFootprint) {
                            console.log(`      🎯 Гибридный: моменты=${footprint.hybridFootprint.moments?.length || 0}`);
                        }
                        if (footprint.name && footprint.name.includes('Топологическая')) {
                            console.log(`      🏗️ Топологическая супер-модель`);
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
            this.stats.superModelsCreated = superModelsLoaded;
            this.stats.topologySuperModelsCreated = topologySuperModelsLoaded;

            console.log(`✅ Загружено ${loaded} моделей (${errors} ошибок)`);
            console.log(`🎯 Гибридных моделей: ${hybridLoaded}`);
            console.log(`🌟 Супер-моделей: ${superModelsLoaded}`);
            console.log(`🏗️ Топологических супер-моделей: ${topologySuperModelsLoaded}`);
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
            useIntelligentMerge: this.config.enableIntelligentMerge,
            useTopologySuperModel: this.config.enableTopologySuperModel,
            stats: {
                photoCount: 0,
                analysisCount: 0,
                autoAlignments: 0,
                mergedCount: 0,
                hybridComparisons: 0,
                mergeVisualizations: 0,
                intelligentMerges: 0,
                topologicalMerges: 0
            }
        };

        this.userSessions.set(userId, session);
        this.activeSessions.set(sessionId, session);
        this.stats.totalSessions++;

        console.log(`🔄 Создана сессия "${name}" для пользователя ${userId}`);
        if (session.useHybrid) {
            console.log(`   🎯 Гибридный режим: ВКЛЮЧЕН`);
        }
        if (session.useIntelligentMerge) {
            console.log(`   🧠 Интеллектуальное слияние: ВКЛЮЧЕНО`);
        }
        if (session.useTopologySuperModel) {
            console.log(`   🏗️ Топологическая супер-модель: ВКЛЮЧЕНА`);
        }

        return session;
    }

    // 4. ПОЛУЧИТЬ АКТИВНУЮ СЕССИЮ ПОЛЬЗОВАТЕЛЯ
    getActiveSession(userId) {
        return this.userSessions.get(userId);
    }

    // 5. ДОБАВИТЬ ФОТО В СЕССИЮ С АВТОСОВМЕЩЕНИЕМ (ОСНОВНОЙ МЕТОД)
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log('\n=== ДИАГНОСТИКА addPhotoToSession ===');
        console.log(`📞 Вызван addPhotoToSession с параметрами:`);
        console.log(`   userId: ${userId}`);
        console.log(`   analysis.predictions: ${analysis.predictions?.length || 0}`);
        console.log(`   bot: ${!!bot} (${bot ? 'передан' : 'НЕ передан!'})`);
        console.log(`   chatId: ${chatId} (${chatId ? 'передан' : 'НЕ передан!'})`);

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
        console.log(`   Предсказаний: ${analysis.predictions?.length || 0}`);

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
            console.log(`   🎯 Создан гибридный отпечаток`);
        }

        // АВТОСОВМЕЩЕНИЕ С ТОПОЛОГИЧЕСКИМ СЛИЯНИЕМ
        let alignmentResult = null;
        let mergeResult = null;
        let mergeVisualizationPath = null;
        let mergeVisualizationStats = null;
        let mergeMethod = 'classic';

        if (this.config.autoAlignment && session.currentFootprint) {
            console.log(`🎯 Запускаю автосовмещение...`);

            // Сравнить отпечатки
            console.log('🔍 Сравниваю отпечатки (await)...');
            const comparison = await session.currentFootprint.compare(tempFootprint);
            console.log(`📊 Результат сравнения: ${comparison.decision}, similarity: ${comparison.similarity}`);

            if (tempFootprint.hybridFootprint && session.currentFootprint.hybridFootprint) {
                session.stats.hybridComparisons++;
            }

            if (comparison.decision === 'same') {
                console.log(`✅ Автосовмещение: тот же след (similarity: ${comparison.similarity})`);

                // ВЫБОР МЕТОДА СЛИЯНИЯ
                if (session.useTopologySuperModel &&
                    session.currentFootprint.hybridFootprint &&
                    tempFootprint.hybridFootprint) {

                    // 🏗️ ИСПОЛЬЗУЕМ ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ
                    console.log('🏗️ Использую топологическое слияние...');

                    try {
                        console.log('🏗️ Выполняем топологическое слияние (await)...');
                        mergeResult = await this.safeMergeResult(
                            session.currentFootprint.hybridFootprint.mergeWithTransformation(
                                tempFootprint.hybridFootprint
                            )
                        );

                        if (mergeResult?.success) {
                            mergeMethod = mergeResult.method || 'topology';
                            session.stats.topologicalMerges++;
                            this.stats.topologicalMerges++;
                            this.stats.intelligentMerges++;

                            console.log(`✅ Топологическое слияние успешно! Метод: ${mergeMethod}`);
                        } else {
                            console.log('❌ Топологическое слияние не удалось');
                        }
                    } catch (mergeError) {
                        console.log('❌ Ошибка при выполнении топологического слияния:', mergeError.message);
                        mergeResult = { success: false, error: mergeError.message };
                    }
                }
                else if (session.useIntelligentMerge &&
                         session.currentFootprint.hybridFootprint &&
                         tempFootprint.hybridFootprint) {

                    // 🧠 ИСПОЛЬЗУЕМ ИНТЕЛЛЕКТУАЛЬНОЕ СЛИЯНИЕ
                    console.log('🧠 Использую интеллектуальное слияние...');

                    try {
                        mergeResult = await this.safeMergeResult(
                            session.currentFootprint.hybridFootprint.mergeWithTransformation(
                                tempFootprint.hybridFootprint
                            )
                        );

                        if (mergeResult?.success) {
                            mergeMethod = mergeResult.method || 'intelligent';
                            session.stats.intelligentMerges++;
                            this.stats.intelligentMerges++;

                            console.log(`✅ Интеллектуальное слияние успешно! Метод: ${mergeMethod}`);
                        }
                    } catch (mergeError) {
                        console.log('❌ Ошибка при выполнении интеллектуального слияния:', mergeError.message);
                        mergeResult = { success: false, error: mergeError.message };
                    }
                } else {
                    // 📊 Классическое слияние
                    console.log('📊 Использую классическое слияние...');
                    mergeResult = session.currentFootprint.merge(tempFootprint);
                    mergeMethod = 'classic';
                }

                if (mergeResult?.success) {
                    session.stats.autoAlignments++;
                    session.stats.mergedCount += mergeResult.mergedPhotos || mergeResult.mergedNodes || 0;

                    alignmentResult = {
                        success: true,
                        similarity: comparison.similarity,
                        decision: mergeResult.transformation ? 'merged_intelligently' : 'merged',
                        mergedNodes: mergeResult.mergedPoints || mergeResult.mergedPhotos || mergeResult.mergedNodes,
                        totalNodes: session.currentFootprint.graph.nodes.size,
                        method: comparison.method || mergeMethod,
                        mergeStats: mergeResult.stats || null,
                        transformation: mergeResult.transformation || null,
                        topologySimilarity: mergeResult.metrics?.structuralSimilarity
                    };

                    // СОЗДАЁМ ВИЗУАЛИЗАЦИЮ СЛИЯНИЯ
                    if (this.config.enableMergeVisualization && mergeResult.success) {
                        console.log('✅ ВКЛЮЧЕНО создание визуализации');
                        try {
                            const timestamp = Date.now();
                            const vizFilename = `merge_${session.id.slice(0, 8)}_${timestamp}.png`;
                            const vizOptions = {
                                outputPath: path.join(this.config.dbPath, 'merge_visualizations', vizFilename),
                                title: 'СЛИЯНИЕ СЛЕДОВ'
                            };

                            // ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ
                            const vizResult = await this.mergeVisualizer.visualizeMerge(
                                session.currentFootprint,
                                tempFootprint,
                                comparison,
                                vizOptions
                            );

                            // ПРОВЕРЯЕМ РЕЗУЛЬТАТ
                            if (vizResult && vizResult.success) {
                                mergeVisualizationPath = vizResult.path || vizOptions.outputPath;
                                mergeVisualizationStats = vizResult.stats || {};
                                session.stats.mergeVisualizations++;
                                this.stats.mergeVisualizations++;

                                console.log(`🎨 Визуализация объединения создана: ${vizFilename}`);
                                console.log(`   📊 Метод: ${mergeMethod}`);
                                console.log(`   📁 Путь: ${mergeVisualizationPath}`);

                                // ОТПРАВКА ВИЗУАЛИЗАЦИИ В TELEGRAM
                                if (bot && chatId && mergeVisualizationPath && fs.existsSync(mergeVisualizationPath)) {
                                    console.log(`✅ ВСЕ УСЛОВИЯ ДЛЯ ОТПРАВКИ ВЫПОЛНЕНЫ! Отправляю в Telegram...`);

                                    setTimeout(async () => {
                                        try {
                                            let caption;
                                            if (mergeMethod === 'topology') {
                                                caption = this.createTopologyMergeCaption(
                                                    session.currentFootprint,
                                                    tempFootprint,
                                                    mergeVisualizationStats
                                                );
                                            } else {
                                                caption = `📊 **СЛИЯНИЕ СЛЕДОВ**\n\n` +
                                                         `📸 ${session.currentFootprint.name}: ${session.currentFootprint.graph.nodes.size} узлов\n` +
                                                         `📸 ${tempFootprint.name}: ${tempFootprint.graph.nodes.size} узлов\n` +
                                                         `🔗 Схожесть: ${comparison.similarity?.toFixed(3) || 0}\n` +
                                                         `🔄 Метод: ${mergeMethod}\n\n` +
                                                         `🎨 **ЦВЕТА:**\n` +
                                                         `🔴 Красный - первый след\n` +
                                                         `🔵 Синий - второй след\n` +
                                                         `🟢 Зеленый - совпавшие точки`;
                                            }

                                            await bot.sendPhoto(chatId, mergeVisualizationPath, {
                                                caption: caption,
                                                parse_mode: 'HTML'
                                            });

                                            console.log(`✅ Визуализация отправлена в чат ${chatId}`);

                                        } catch (sendError) {
                                            console.log('⚠️ Не удалось отправить визуализацию:', sendError.message);
                                        }
                                    }, 500);
                                }
                            }
                        } catch (vizError) {
                            console.log('⚠️ Не удалось создать визуализацию:', vizError.message);
                        }
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
            mergeMethod: mergeMethod,
            topologySimilarity: mergeResult?.metrics?.structuralSimilarity
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
            mergeMethod: mergeMethod,
            topologySimilarity: mergeResult?.metrics?.structuralSimilarity
        };

        // Автосохранение
        if (this.config.autoSave && session.currentFootprint) {
            this.autoSaveSession(session);
        }

        console.log('\n📊 ИТОГОВАЯ ДИАГНОСТИКА СЕССИИ:');
        console.log(`- mergeVisualizationPath: ${mergeVisualizationPath}`);
        console.log(`- mergeMethod: ${mergeMethod}`);

        return result;
    }

    // 6. ВСПОМОГАТЕЛЬНЫЙ МЕТОД: БЕЗОПАСНАЯ ОБРАБОТКА PROMISE
    async safeMergeResult(mergePromise) {
        try {
            let result = mergePromise;

            // Проверяем, является ли результат Promise
            if (result && typeof result.then === 'function') {
                console.log('⚡ Обнаружен Promise, ожидаю результат...');
                result = await result;
            }

            // Дополнительная проверка для вложенных Promise
            if (result && typeof result.then === 'function') {
                console.log('⚡ Вложенный Promise, ожидаю еще раз...');
                result = await result;
            }

            return result;
        } catch (error) {
            console.log('❌ Ошибка в safeMergeResult:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 7. ПОДПИСЬ ДЛЯ ТОПОЛОГИЧЕСКОГО СЛИЯНИЯ
    createTopologyMergeCaption(footprint1, footprint2, stats) {
        return `<b>🏗️ ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ</b>\n\n` +
               `<b>📸 ${footprint1.name}:</b> ${stats.points1 || footprint1.graph.nodes.size} узлов\n` +
               `<b>📸 ${footprint2.name}:</b> ${stats.points2 || footprint2.graph.nodes.size} узлов\n` +
               `<b>🔗 Структурных соответствий:</b> ${stats.structuralMatches || 0}\n` +
               `<b>🏗️ Топологическая схожесть:</b> ${(stats.structuralSimilarity || 0).toFixed(3)}\n` +
               `<b>📊 Сохранено топологии:</b> ${stats.preservedStructures || 0}%\n\n` +
               `<i>🟣 Топологические соответствия | 🔵 Узлы графа | 🔴 Рёбра графа</i>`;
    }

    // 8. АВТОСОХРАНЕНИЕ СЕССИИ
    autoSaveSession(session) {
        if (!session.currentFootprint) return;

        try {
            const filename = `autosave_${session.id}_${Date.now()}.json`;
            const filePath = path.join(this.config.dbPath, filename);

            const data = session.currentFootprint.toJSON();
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

            if (this.config.debug) {
                console.log(`💾 Автосохранение: ${filename} (${data.graph.nodes.length} узлов)`);
            }
        } catch (error) {
            console.log(`⚠️ Ошибка автосохранения: ${error.message}`);
        }
    }

    // 9. СОХРАНИТЬ СЕССИЮ КАК МОДЕЛЬ
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

        // Определить тип модели
        let name = modelName || session.name;

        // Обновить имя модели
        session.currentFootprint.name = name;
        session.currentFootprint.metadata.lastUpdated = new Date();
        session.currentFootprint.metadata.sessionStats = session.stats;

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
                topologyScore: session.currentFootprint.hybridFootprint?.stats.topologyScore || 0,
                photos: session.currentFootprint.metadata.totalPhotos,
                hasHybrid: session.currentFootprint.hybridFootprint !== null
            },
            sessionInfo: {
                photos: session.photos.length,
                analyses: session.analyses.length,
                autoAlignments: session.stats.autoAlignments,
                mergeVisualizations: session.stats.mergeVisualizations
            }
        };
    }

    // 10. СОХРАНИТЬ МОДЕЛЬ В БАЗУ
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

            return {
                success: true,
                modelId: footprint.id,
                filename: filename,
                path: filePath,
                stats: {
                    nodes: footprint.graph.nodes.size,
                    edges: footprint.graph.edges.size,
                    confidence: footprint.stats.confidence,
                    topologyScore: footprint.hybridFootprint?.stats.topologyScore || 0,
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

    // 11. ОБНОВИТЬ ИНДЕКСНЫЙ ФАЙЛ
    updateIndexFile() {
        try {
            const indexPath = path.join(this.config.dbPath, '_index.json');

            const index = {
                version: '1.3',
                updated: new Date().toISOString(),
                totalModels: this.modelCache.size,
                hybridModels: this.stats.hybridModels,
                superModels: this.stats.superModelsCreated,
                topologySuperModels: this.stats.topologySuperModelsCreated || 0,
                totalUsers: this.userModels.size,
                mergeVisualizations: this.stats.mergeVisualizations,
                users: {},
                stats: this.stats
            };

            // Добавить статистику по пользователям
            this.userModels.forEach((models, userId) => {
                const hybridModels = models.filter(m => m.hybridFootprint).length;
                const superModels = models.filter(m => m.name && m.name.startsWith('Супер-модель')).length;
                const topologySuperModels = models.filter(m => m.name && m.name.includes('Топологическая')).length;

                index.users[userId] = {
                    modelCount: models.length,
                    hybridModels: hybridModels,
                    superModels: superModels,
                    topologySuperModels: topologySuperModels,
                    lastModel: models[models.length - 1]?.metadata?.lastUpdated || null
                };
            });

            fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

        } catch (error) {
            console.log(`⚠️ Ошибка обновления индекса: ${error.message}`);
        }
    }

    // 12. ЗАВЕРШИТЬ СЕССИЮ
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
        console.log(`   Причина: ${reason}`);
        console.log(`   Длительность: ${Math.round(duration / 1000)} сек`);
        console.log(`   Фото: ${session.photos.length}`);
        console.log(`   Анализов: ${session.analyses.length}`);
        console.log(`   Гибридных сравнений: ${session.stats.hybridComparisons}`);
        console.log(`   Визуализаций объединения: ${session.stats.mergeVisualizations}`);

        return {
            success: true,
            sessionId: session.id,
            duration: duration,
            stats: session.stats,
            currentFootprint: session.currentFootprint ? {
                id: session.currentFootprint.id,
                name: session.currentFootprint.name,
                nodes: session.currentFootprint.graph.nodes.size,
                edges: session.currentFootprint.graph.edges.size,
                confidence: session.currentFootprint.stats.confidence,
                topologyScore: session.currentFootprint.hybridFootprint?.stats.topologyScore || 0,
                hasHybrid: session.currentFootprint.hybridFootprint !== null
            } : null
        };
    }

    // 13. ПОЛУЧИТЬ МОДЕЛИ ПОЛЬЗОВАТЕЛЯ
    getUserModels(userId) {
        return this.userModels.get(userId) || [];
    }

    // 14. ПОЛУЧИТЬ СТАТИСТИКУ СИСТЕМЫ
    getSystemStats() {
        const now = new Date();
        const uptime = now - this.stats.startedAt;

        return {
            system: {
                started: this.stats.startedAt.toLocaleString('ru-RU'),
                uptime: Math.round(uptime / 1000),
                version: '1.3'
            },
            storage: {
                totalModels: this.stats.totalModels,
                hybridModels: this.stats.hybridModels,
                superModels: this.stats.superModelsCreated,
                topologySuperModels: this.stats.topologySuperModelsCreated || 0,
                totalUsers: this.userModels.size,
                activeSessions: this.activeSessions.size,
                modelCache: this.modelCache.size,
                mergeVisualizations: this.stats.mergeVisualizations
            },
            performance: {
                totalSessions: this.stats.totalSessions,
                totalComparisons: this.stats.totalComparisons,
                successfulAlignments: this.stats.successfulAlignments,
                hybridComparisons: this.stats.hybridComparisons,
                mergeVisualizations: this.stats.mergeVisualizations
            },
            config: {
                dbPath: this.config.dbPath,
                autoAlignment: this.config.autoAlignment,
                autoSave: this.config.autoSave,
                useHybridMode: this.config.useHybridMode,
                enableMergeVisualization: this.config.enableMergeVisualization,
                enableIntelligentMerge: this.config.enableIntelligentMerge,
                enableTopologySuperModel: this.config.enableTopologySuperModel,
                topologySimilarityThreshold: this.config.topologySimilarityThreshold,
                debug: this.config.debug
            }
        };
    }

    // 15. ПОЛУЧИТЬ МОДЕЛЬ ПО ID
    getModelById(modelId) {
        return this.modelCache.get(modelId) || null;
    }

    // 16. ПОЛУЧИТЬ ПОСЛЕДНЮЮ ВИЗУАЛИЗАЦИЮ ОБЪЕДИНЕНИЯ
    getLastMergeVisualization(userId) {
        const session = this.getActiveSession(userId);
        if (!session || !session.analyses || session.analyses.length === 0) {
            return null;
        }

        // Ищем последний анализ с визуализацией
        for (let i = session.analyses.length - 1; i >= 0; i--) {
            const analysis = session.analyses[i];
            if (analysis.mergeVisualization && fs.existsSync(analysis.mergeVisualization)) {
                return {
                    path: analysis.mergeVisualization,
                    similarity: analysis.alignment?.similarity || 0,
                    mergedNodes: analysis.alignment?.mergedNodes || 0,
                    photos: session.photos.slice(0, i + 1),
                    timestamp: analysis.timestamp
                };
            }
        }

        return null;
    }

    // 17. ПОЛУЧИТЬ КОЛИЧЕСТВО ВИЗУАЛИЗАЦИЙ
    getMergeVisualizationCount() {
        return this.stats.mergeVisualizations;
    }
}

module.exports = SimpleFootprintManager;
