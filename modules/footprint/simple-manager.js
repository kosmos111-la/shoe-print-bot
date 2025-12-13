// modules/footprint/simple-manager.js
// МЕНЕДЖЕР СИСТЕМЫ ЦИФРОВЫХ ОТПЕЧАТКОВ - С ТОПОЛОГИЧЕСКОЙ СУПЕР-МОДЕЛЬЮ (ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ)

const fs = require('fs');
const path = require('path');
const SimpleFootprint = require('./simple-footprint');
const SimpleGraphMatcher = require('./simple-matcher');
const HybridFootprint = require('./hybrid-footprint');
const MergeVisualizer = require('./merge-visualizer');
const TopologyMerger = require('./topology-merger');
const StructuralSuperModel = require('./structural-super-model');
const TopologyIntegration = require('./topology-integration');

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

        // ИНИЦИАЛИЗАЦИЯ ИНТЕГРАЦИИ ТОПОЛОГИИ
        this.topologyIntegration = new TopologyIntegration({
            enableValidation: true,
            enableVisualization: true,
            debug: this.config.debug
        });

        // Хранилища
        this.userSessions = new Map();      // userId -> session
        this.userModels = new Map();        // userId -> [footprints]
        this.activeSessions = new Map();    // sessionId -> session
        this.modelCache = new Map();        // modelId -> footprint
        this.superModels = new Map();       // userId -> [superModels]

        // НОВОЕ: Структурные супер-модели
        this.structuralSuperModels = new Map(); // userId -> StructuralSuperModel

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
        console.log(`🧠 Интеллектуальное слияние: ${this.config.enableIntelligentMerge ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);
        console.log(`🌟 Супер-модели: ${this.config.enableSuperModel ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
        console.log(`🏗️ Топологические супер-модели: ${this.config.enableTopologySuperModel ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    // Инициализировать структуру папок
const DataStructureInitializer = require('./utils/init-data-structure');
const dataInitializer = new DataStructureInitializer(this.config.dbPath);
dataInitializer.initAllFolders();

// Проверить существующую структуру
const structureCheck = dataInitializer.checkExistingStructure();
if (structureCheck.missing.length > 0) {
    console.log('⚠️ ВНИМАНИЕ: Неполная структура папок!');
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

            // СОЗДАТЬ ПАПКУ ДЛЯ ВИЗУАЛИЗАЦИЙ ОБЪЕДИНЕНИЯ
            const mergeVizDir = path.join(this.config.dbPath, 'merge_visualizations');
            if (!fs.existsSync(mergeVizDir)) {
                fs.mkdirSync(mergeVizDir, { recursive: true });
                console.log(`📁 Создана папка для визуализаций объединений: ${mergeVizDir}`);
            }

            // СОЗДАТЬ ПАПКУ ДЛЯ ТОПОЛОГИЧЕСКИХ СУПЕР-МОДЕЛЕЙ
            const topologyDir = path.join(this.config.dbPath, 'topology_supermodels');
            if (!fs.existsSync(topologyDir)) {
                fs.mkdirSync(topologyDir, { recursive: true });
                console.log(`📁 Создана папка для топологических супер-моделей: ${topologyDir}`);
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
                        console.log(`   📦 Загружена модель: ${footprint.name} (${footprint.graph.nodes.size} узлов)`);
                        if (footprint.hybridFootprint) {
                            console.log(`      🎯 Гибридный: моменты=${footprint.hybridFootprint.moments?.length || 0}`);
                        }
                        if (footprint.name && footprint.name.includes('Топологическая')) {
                            console.log(`      🏗️ Топологическая супер-модель`);
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
            console.log(`   🎯 Гибридный режим: ВКЛЮЧЕН`);
        }
        if (session.useIntelligentMerge) {
            console.log(`   🧠 Интеллектуальное слияние: ВКЛЮЧЕНО`);
        }
        if (session.useTopologySuperModel) {
            console.log(`   🏗️ Топологическая супер-модель: ВКЛЮЧЕНА`);
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
        console.log(`   userId: ${userId}`);
        console.log(`   analysis.predictions: ${analysis.predictions?.length || 0}`);
        console.log(`   bot: ${!!bot} (${bot ? 'передан' : 'НЕ передан!'})`);
        console.log(`   chatId: ${chatId} (${chatId ? 'передан' : 'НЕ передан!'})`);

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

                // РАСШИРЕННАЯ ДИАГНОСТИКА ПЕРЕД СЛИЯНИЕМ
                console.log('\n🔍 ДИАГНОСТИКА ПЕРЕД СЛИЯНИЕМ:');
                console.log(`1. session.useTopologySuperModel: ${session.useTopologySuperModel}`);
                console.log(`2. session.useIntelligentMerge: ${session.useIntelligentMerge}`);
                console.log(`3. session.currentFootprint.hybridFootprint: ${!!session.currentFootprint.hybridFootprint}`);
                console.log(`4. tempFootprint.hybridFootprint: ${!!tempFootprint.hybridFootprint}`);
                console.log(`5. this.config.enableMergeVisualization: ${this.config.enableMergeVisualization}`);

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

                        // ДЕТАЛЬНАЯ ДИАГНОСТИКА РЕЗУЛЬТАТА СЛИЯНИЯ
                        console.log('\n🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА РЕЗУЛЬТАТА mergeWithTransformation:');
                        console.log(`1. Тип mergeResult: ${typeof mergeResult}`);
                        console.log(`2. mergeResult.success: ${mergeResult?.success}`);
                       
                        if (mergeResult?.success) {
                            mergeMethod = mergeResult.method || 'topology';
                            session.stats.topologicalMerges++;
                            this.stats.topologicalMerges++;
                            this.stats.intelligentMerges++;

                            console.log(`✅ Топологическое слияние успешно! Метод: ${mergeMethod}`);
                           
                            // ПРОВЕРКА ВОЗМОЖНОСТИ СОЗДАНИЯ ТОПОЛОГИЧЕСКОЙ СУПЕР-МОДЕЛИ
                            if (mergeResult.metrics?.structuralSimilarity > 0.8 &&
                                session.currentFootprint.graph.nodes.size > 40) {

                                console.log('🏗️ Проверяю возможность создания топологической супер-модели...');

                                // Проверяем достаточно ли топологического качества
                                if (session.currentFootprint.hybridFootprint.stats.topologyScore > 0.7) {
                                    await this.tryCreateTopologySuperModel(session, userId, bot, chatId);
                                }
                            }
                        } else {
                            console.log('❌ Топологическое слияние не удалось, проверяем причину:');
                            console.log(`- error: ${mergeResult?.error}`);
                            console.log(`- reason: ${mergeResult?.reason}`);
                        }
                    } catch (mergeError) {
                        console.log('❌ Ошибка при выполнении топологического слияния:', mergeError.message);
                        console.error(mergeError.stack);
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

                            // Проверка возможности создания супер-модели
                            if (mergeResult.confidence > this.config.superModelConfidenceThreshold) {

                                console.log('🌟 Проверяю возможность создания супер-модели...');

                                if (session.currentFootprint.graph.nodes.size > 30) {
                                    await this.tryCreateSuperModel(session, userId, bot, chatId);
                                }
                            }
                        } else {
                            console.log(`❌ Интеллектуальное слияние не удалось: ${mergeResult?.error || 'неизвестная ошибка'}`);
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

                    if (mergeResult?.success) {
                        console.log(`✅ Классическое слияние успешно!`);
                    } else {
                        console.log(`❌ Классическое слияние не удалось: ${mergeResult?.error || 'неизвестная ошибка'}`);
                    }
                }

                // РАСШИРЕННАЯ ДИАГНОСТИКА ПОСЛЕ СЛИЯНИЯ
                console.log('\n🔍 ДИАГНОСТИКА ПОСЛЕ СЛИЯНИЯ:');
                console.log(`1. mergeResult: ${mergeResult ? 'есть' : 'нет'}`);
                console.log(`2. mergeResult?.success: ${mergeResult?.success || false}`);
                console.log(`3. mergeMethod: ${mergeMethod}`);
                console.log(`4. this.config.enableMergeVisualization: ${this.config.enableMergeVisualization}`);

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

                    // ДИАГНОСТИКА ПЕРЕД СОЗДАНИЕМ ВИЗУАЛИЗАЦИИ
                    console.log('\n🎯 ПРОВЕРКА ВИЗУАЛИЗАЦИИ:');
                    console.log(`- config.enableMergeVisualization: ${this.config.enableMergeVisualization}`);
                    console.log(`- mergeResult.success: ${mergeResult.success}`);

                    // СОЗДАЁМ ВИЗУАЛИЗАЦИЮ СЛИЯНИЯ
if (this.config.enableMergeVisualization && mergeResult.success) {
    console.log('✅ ВКЛЮЧЕНО создание визуализации');
    try {
        const timestamp = Date.now();
       
        // ВСЕГДА используем визуализацию супер-модели для топологического слияния
        console.log('🏗️ Использую визуализацию супер-модели...');
       
        const vizFilename = `super_model_${session.id.slice(0, 8)}_${timestamp}.png`;
        const vizOptions = {
            outputPath: path.join(this.config.dbPath, 'merge_visualizations', vizFilename),
            title: 'СУПЕР-МОДЕЛЬ'
        };

        // ВИЗУАЛИЗАЦИЯ СУПЕР-МОДЕЛИ
        const vizResult = await this.mergeVisualizer.visualizeSuperModel(
            session.currentFootprint,  // Супер-модель
            tempFootprint,             // Последняя модель (для обводки)
            vizOptions
        );
       
        // ПРОВЕРЯЕМ РЕЗУЛЬТАТ
        if (vizResult && vizResult.success) {
            mergeVisualizationPath = vizResult.path || vizOptions.outputPath;
            mergeVisualizationStats = vizResult.stats || {};
            session.stats.mergeVisualizations++;
            this.stats.mergeVisualizations++;

            console.log(`🎨 Визуализация супер-модели создана: ${vizFilename}`);
            console.log(`   📊 Метод: ${mergeMethod}`);
            console.log(`   📁 Путь: ${mergeVisualizationPath}`);
            console.log(`   📊 Статистика:`, mergeVisualizationStats);
           
            // ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ
            console.log(`   🏗️ Супер-модель: ${session.currentFootprint.graph.nodes.size} узлов`);
            console.log(`   🎯 Подтвержденных узлов: ${mergeVisualizationStats.confirmedNodes || 0}`);
        } else {
            console.log('⚠️ Визуализация супер-модели не создана');
            console.log(`   Результат:`, vizResult);
           
            // Попробуем старую визуализацию как запасной вариант
            console.log('🔄 Пробую старую визуализацию...');
            const oldViz = await this.mergeVisualizer.visualizeTopologyMerge(
                session.currentFootprint,
                tempFootprint,
                comparison,
                vizOptions
            );
            if (oldViz.success) {
                mergeVisualizationPath = oldViz.path;
                console.log(`✅ Старая визуализация создана: ${mergeVisualizationPath}`);
            }
        }

    } catch (vizError) {
        console.log('⚠️ Не удалось создать визуализацию:', vizError.message);
        console.error(vizError.stack);
    }
} else {
    console.log('❌ ВЫКЛЮЧЕНО создание визуализации или слияние не удалось');
}

                    // ДИАГНОСТИКА ОТПРАВКИ В TELEGRAM
                    console.log('\n🎯 ДИАГНОСТИКА ОТПРАВКИ ВИЗУАЛИЗАЦИИ:');
                    console.log(`1. bot доступен: ${!!bot} (${bot ? 'YES' : 'NO'})`);
                    console.log(`2. chatId: ${chatId} (${chatId ? 'YES' : 'NO'})`);
                    console.log(`3. mergeVisualizationPath: ${mergeVisualizationPath}`);
                    console.log(`4. Метод слияния: ${mergeMethod}`);
                    console.log(`5. Статистика: ${mergeVisualizationStats ? 'есть' : 'нет'}`);

                    if (mergeVisualizationPath) {
                        const exists = fs.existsSync(mergeVisualizationPath);
                        console.log(`6. Файл существует: ${exists}`);
                        if (!exists) {
                            console.log(`   🔍 Ищу файлы в: ${path.dirname(mergeVisualizationPath)}`);
                            try {
                                const files = fs.readdirSync(path.dirname(mergeVisualizationPath));
                                const pngFiles = files.filter(f => f.endsWith('.png'));
                                console.log(`   📁 Найдено PNG файлов: ${pngFiles.length}`);
                                if (pngFiles.length > 0) {
                                    console.log(`   📋 Примеры: ${pngFiles.slice(0, 3).join(', ')}`);
                                }
                            } catch (err) {
                                console.log(`   ❌ Ошибка чтения директории: ${err.message}`);
                            }
                        }
                    }

                    // ОТПРАВКА ВИЗУАЛИЗАЦИИ В TELEGRAM
                    if (bot && chatId && mergeVisualizationPath && fs.existsSync(mergeVisualizationPath)) {
                        console.log(`✅ ВСЕ УСЛОВИЯ ДЛЯ ОТПРАВКИ ВЫПОЛНЕНЫ! Отправляю в Telegram...`);

                        setTimeout(async () => {
                            try {
                                let caption;
                                if (mergeMethod === 'topology' || mergeMethod === 'topology_merge') {
                                    caption = this.createTopologyMergeCaption(
                                        session.currentFootprint,
                                        tempFootprint,
                                        mergeVisualizationStats || {
                                            points1: session.currentFootprint.graph.nodes.size,
                                            points2: tempFootprint.graph.nodes.size,
                                            structuralMatches: mergeResult.topologyMergeResult?.structuralMatches?.length || 0,
                                            structuralSimilarity: mergeResult.metrics?.structuralSimilarity || 0,
                                            preservedStructures: mergeResult.metrics?.preservedStructures || 0
                                        }
                                    );
                                } else if (mergeMethod === 'intelligent') {
                                    caption = this.mergeVisualizer.createIntelligentMergeCaption?.(
                                        session.currentFootprint,
                                        tempFootprint,
                                        mergeVisualizationStats
                                    ) || `🧠 Интеллектуальное слияние\n\nСлито ${mergeResult.mergedPoints || 0} точек`;
                                } else {
                                    caption = this.mergeVisualizer.createMergeCaption?.(
                                        session.currentFootprint,
                                        tempFootprint,
                                        mergeVisualizationStats
                                    ) || `📊 Классическое слияние\n\nСхожесть: ${comparison.similarity?.toFixed(3) || 0}`;
                                }

                                await bot.sendPhoto(chatId, mergeVisualizationPath, {
                                    caption: caption,
                                    parse_mode: 'HTML'
                                });

                                console.log(`✅ Визуализация отправлена в чат ${chatId}`);

                            } catch (sendError) {
                                console.log('⚠️ Не удалось отправить визуализацию:', sendError.message);
                                console.error(sendError.stack);
                            }
                        }, 500);
                    } else {
                        console.log(`❌ НЕ ВЫПОЛНЕНЫ УСЛОВИЯ ОТПРАВКИ:`);
                        if (!bot) console.log(`   - bot не доступен`);
                        if (!chatId) console.log(`   - chatId не указан`);
                        if (!mergeVisualizationPath) console.log(`   - mergeVisualizationPath: null`);
                        if (mergeVisualizationPath && !fs.existsSync(mergeVisualizationPath)) console.log(`   - Файл не существует: ${mergeVisualizationPath}`);
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

        // ИТОГОВАЯ ДИАГНОСТИКА
        console.log('\n📊 ИТОГОВАЯ ДИАГНОСТИКА СЕССИИ:');
        console.log(`- mergeVisualizationPath: ${mergeVisualizationPath}`);
        console.log(`- mergeMethod: ${mergeMethod}`);
        console.log(`- Условия отправки: bot=${!!bot}, chatId=${!!chatId}, path=${!!mergeVisualizationPath}, exists=${mergeVisualizationPath ? fs.existsSync(mergeVisualizationPath) : false}`);

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

    // 7. СОЗДАТЬ ТОПОЛОГИЧЕСКУЮ СУПЕР-МОДЕЛЬ
    async tryCreateTopologySuperModel(session, userId, bot = null, chatId = null) {
        try {
            console.log('🏗️ Создаю ТОПОЛОГИЧЕСКУЮ СУПЕР-МОДЕЛЬ...');

            // Получить все модели
            const userModels = this.getUserModels(userId);
            if (userModels.length < 3) {
                console.log('⚠️ Недостаточно моделей для топологической супер.модели (минимум 3)');
                return null;
            }

            // Найти модели с высокой топологической оценкой
            const topologyModels = userModels
                .filter(m => m.hybridFootprint &&
                           m.hybridFootprint.stats.topologyScore > 0.6 &&
                           m.graph.nodes.size > 20)
                .sort((a, b) => b.hybridFootprint.stats.topologyScore - a.hybridFootprint.stats.topologyScore);

            if (topologyModels.length < 2) {
                console.log('⚠️ Не найдено достаточно моделей с хорошей топологией');
                return null;
            }

            console.log(`🎯 Найдено ${topologyModels.length} моделей с хорошей топологией`);

            // Начать с модели с наивысшей топологической оценкой
            let superModel = topologyModels[0];
            const mergedModels = [superModel];

            // ИСПОЛЬЗУЕМ TOPOLOGY MERGER ДЛЯ ПОСЛЕДОВАТЕЛЬНОГО СЛИЯНИЯ
            for (let i = 1; i < Math.min(topologyModels.length, 5); i++) {
                const currentModel = topologyModels[i];

                console.log(`🏗️ Топологическое слияние с "${currentModel.name}"...`);

                const topologyComparison = await superModel.hybridFootprint.compareTopology(
                    currentModel.hybridFootprint?.graph || currentModel.graph
                );

                if (topologyComparison.similarity > this.config.topologySimilarityThreshold) {
                    const mergeResult = await this.safeMergeResult(
                        superModel.hybridFootprint.mergeWithTransformation(
                            currentModel.hybridFootprint
                        )
                    );

                    if (mergeResult?.success && mergeResult.method === 'topology_merge') {
                        mergedModels.push(currentModel);
                        console.log(`✅ Добавлено к топологической супер-модели:`);
                        console.log(`   🏗️ Структурных соответствий: ${mergeResult.topologyMergeResult?.structuralMatches?.length || 0}`);
                        console.log(`   📊 Топологическая схожесть: ${mergeResult.metrics?.structuralSimilarity || 0}`);
                        console.log(`   🔗 Сохранено топологии: ${mergeResult.metrics?.preservedStructures || 0}%`);
                    }
                } else {
                    console.log(`⚠️ Пропускаем "${currentModel.name}" - низкая топологическая схожесть: ${topologyComparison.similarity.toFixed(3)}`);
                }
            }

            // Сохранить топологическую супер-модель
            const superModelName = `Топологическая супер-модель_${new Date().toLocaleDateString('ru-RU')}`;
            superModel.name = superModelName;

            const saveResult = this.saveTopologySuperModel(superModel, userId);

            if (!saveResult.success) {
                console.log(`❌ Ошибка сохранения топологической супер-модели: ${saveResult.error}`);
                return null;
            }

            // Создать визуализацию
            const vizPath = path.join(this.config.dbPath, 'topology_supermodels',
                `topology_super_model_${Date.now()}.png`);

            await this.mergeVisualizer.visualizeSuperModel(
                superModel,
                mergedModels,
                vizPath
            );

            // Обновить статистику
            this.stats.topologySuperModelsCreated = (this.stats.topologySuperModelsCreated || 0) + 1;

            console.log(`🏗️ ТОПОЛОГИЧЕСКАЯ СУПЕР-МОДЕЛЬ СОЗДАНА!`);
            console.log(`   📊 ${mergedModels.length} моделей объединены топологически`);
            console.log(`   🏗️ ${superModel.graph.nodes.size} узлов, ${superModel.graph.edges.size} рёбер`);
            console.log(`   🎯 Топологический score: ${Math.round(superModel.hybridFootprint?.stats.topologyScore * 100)}%`);
            console.log(`   💎 Общая уверенность: ${Math.round(superModel.stats.confidence * 100)}%`);
            console.log(`   🎨 Визуализация: ${vizPath}`);

            // Отправить в Telegram
            if (bot && chatId && fs.existsSync(vizPath)) {
                setTimeout(async () => {
                    try {
                        const caption = this.createTopologySuperModelCaption(superModel, mergedModels);

                        await bot.sendPhoto(chatId, vizPath, {
                            caption: caption,
                            parse_mode: 'HTML'
                        });

                        console.log(`✅ Визуализация топологической супер-модели отправлена в чат ${chatId}`);

                    } catch (sendError) {
                        console.log('⚠️ Не удалось отправить визуализацию:', sendError.message);
                    }
                }, 500);
            }

            return {
                success: true,
                superModelId: superModel.id,
                superModelName: superModelName,
                mergedModels: mergedModels.length,
                totalNodes: superModel.graph.nodes.size,
                totalEdges: superModel.graph.edges.size,
                topologyScore: superModel.hybridFootprint?.stats.topologyScore || 0,
                confidence: superModel.stats.confidence,
                visualizationPath: vizPath,
                type: 'topology'
            };

        } catch (error) {
            console.log(`❌ Ошибка создания топологической супер-модели: ${error.message}`);
            console.error(error.stack);
            return null;
        }
    }

    // 8. СОХРАНИТЬ ТОПОЛОГИЧЕСКУЮ СУПЕР-МОДЕЛЬ
    saveTopologySuperModel(footprint, userId) {
        try {
            const filename = `topology_supermodel_${footprint.id}.json`;
            const filePath = path.join(this.config.dbPath, 'topology_supermodels', filename);

            // Добавить метаданные
            footprint.metadata.topologySuperModel = true;
            footprint.metadata.topologyScore = footprint.hybridFootprint?.stats.topologyScore || 0;
            footprint.metadata.createdAsSuperModel = new Date();

            // Преобразовать в JSON
            const data = footprint.toJSON();

            // Сохранить файл
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

            // Добавить в кэш
            this.modelCache.set(footprint.id, footprint);

            // Добавить в супер-модели пользователя
            if (!this.superModels.has(userId)) {
                this.superModels.set(userId, []);
            }
            this.superModels.get(userId).push(footprint);

            // Обновить индексный файл
            this.updateIndexFile();

            console.log(`💾 Топологическая супер-модель сохранена: ${footprint.name}`);
            console.log(`   🏗️ Топологический score: ${Math.round(footprint.metadata.topologyScore * 100)}%`);

            return {
                success: true,
                modelId: footprint.id,
                filename: filename,
                path: filePath,
                topologyScore: footprint.metadata.topologyScore
            };

        } catch (error) {
            console.log(`❌ Ошибка сохранения топологической супер-модели: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 9. ПОДПИСЬ ДЛЯ ТОПОЛОГИЧЕСКОГО СЛИЯНИЯ
    createTopologyMergeCaption(footprint1, footprint2, stats) {
        return `<b>🏗️ ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ</b>\n\n` +
               `<b>📸 ${footprint1.name}:</b> ${stats.points1} узлов\n` +
               `<b>📸 ${footprint2.name}:</b> ${stats.points2} узлов\n` +
               `<b>🔗 Структурных соответствий:</b> ${stats.structuralMatches || 0}\n` +
               `<b>🏗️ Топологическая схожесть:</b> ${(stats.structuralSimilarity || 0).toFixed(3)}\n` +
               `<b>📊 Сохранено топологии:</b> ${stats.preservedStructures || 0}%\n\n` +
               `<i>🟣 Топологические соответствия | 🔵 Узлы графа | 🔴 Рёбра графа</i>`;
    }

    // 10. ПОДПИСЬ ДЛЯ ТОПОЛОГИЧЕСКОЙ СУПЕР-МОДЕЛИ
    createTopologySuperModelCaption(superModel, mergedModels) {
        const mergedCount = mergedModels.length;
        const nodeReduction = mergedModels.reduce((sum, m) => sum + m.graph.nodes.size, 0) -
                              superModel.graph.nodes.size;
        const efficiency = (nodeReduction / mergedModels.reduce((sum, m) => sum + m.graph.nodes.size, 0) * 100).toFixed(1);

        const edgeReduction = mergedModels.reduce((sum, m) => sum + m.graph.edges.size, 0) -
                              superModel.graph.edges.size;
        const edgeEfficiency = (edgeReduction / mergedModels.reduce((sum, m) => sum + m.graph.edges.size, 0) * 100).toFixed(1);

        return `<b>🏗️ ТОПОЛОГИЧЕСКАЯ СУПЕР-МОДЕЛЬ СОЗДАНА!</b>\n\n` +
               `<b>🎯 Объединено моделей:</b> ${mergedCount}\n` +
               `<b>📊 Узлов до:</b> ${mergedModels.reduce((sum, m) => sum + m.graph.nodes.size, 0)}\n` +
               `<b>🎯 Узлов после:</b> ${superModel.graph.nodes.size} (${efficiency}% эффективность)\n` +
               `<b>🔗 Рёбер до:</b> ${mergedModels.reduce((sum, m) => sum + m.graph.edges.size, 0)}\n` +
               `<b>🔗 Рёбер после:</b> ${superModel.graph.edges.size} (${edgeEfficiency}% эффективность)\n` +
               `<b>🏗️ Топологический score:</b> ${Math.round((superModel.hybridFootprint?.stats.topologyScore || 0) * 100)}%\n` +
               `<b>💎 Общая уверенность:</b> ${Math.round(superModel.stats.confidence * 100)}%\n\n` +
               `<i>🟣 Топологические соответствия | 🔵 Структурные узлы | 🔴 Сохранённые рёбра</i>`;
    }

    // 11. АВТОСОХРАНЕНИЕ СЕССИИ
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
                if (session.stats.topologicalMerges > 0) {
                    console.log(`   🏗️ Топологических слияний: ${session.stats.topologicalMerges}`);
                }
            }
        } catch (error) {
            console.log(`⚠️ Ошибка автосохранения: ${error.message}`);
        }
    }

    // 12. СОХРАНИТЬ СЕССИЮ КАК МОДЕЛЬ
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
        let isTopologyModel = false;

        if (session.stats.topologicalMerges > 2 &&
            session.currentFootprint.hybridFootprint?.stats.topologyScore > 0.7) {
            name = `Топологическая_${name}`;
            isTopologyModel = true;
        } else if (session.stats.intelligentMerges > 0) {
            name = `Интеллектуальная_${name}`;
        }

        // Обновить имя модели
        session.currentFootprint.name = name;
        session.currentFootprint.metadata.lastUpdated = new Date();
        session.currentFootprint.metadata.sessionStats = session.stats;

        // Сохранить модель
        let saveResult;
        if (isTopologyModel) {
            saveResult = this.saveTopologySuperModel(session.currentFootprint, userId);
        } else {
            saveResult = this.saveModel(session.currentFootprint);
        }

        if (!saveResult.success) {
            return saveResult;
        }

        // Закрыть сессию
        this.endSession(userId, 'saved_as_model');

        return {
            success: true,
            modelId: saveResult.modelId,
            modelName: name,
            modelType: isTopologyModel ? 'topology' : (session.stats.intelligentMerges > 0 ? 'intelligent' : 'classic'),
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
                hybridComparisons: session.stats.hybridComparisons,
                mergeVisualizations: session.stats.mergeVisualizations,
                intelligentMerges: session.stats.intelligentMerges,
                topologicalMerges: session.stats.topologicalMerges
            }
        };
    }

    // 13. СОХРАНИТЬ МОДЕЛЬ В БАЗУ
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
            if (footprint.name && footprint.name.includes('Топологическая')) {
                console.log(`   🏗️ Топологическая модель`);
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

    // 14. ОБНОВИТЬ ИНДЕКСНЫЙ ФАЙЛ
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
                intelligentMerges: this.stats.intelligentMerges,
                topologicalMerges: this.stats.topologicalMerges || 0,
                superModelsCreated: this.stats.superModelsCreated,
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

    // 15. ЗАВЕРШИТЬ СЕССИЮ
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
        console.log(`   Интеллектуальных слияний: ${session.stats.intelligentMerges}`);
        console.log(`   Топологических слияний: ${session.stats.topologicalMerges}`);

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

    // 16. ПОЛУЧИТЬ МОДЕЛИ ПОЛЬЗОВАТЕЛЯ
    getUserModels(userId) {
        return this.userModels.get(userId) || [];
    }

    // 17. ПОЛУЧИТЬ ТОПОЛОГИЧЕСКИЕ СУПЕР-МОДЕЛИ ПОЛЬЗОВАТЕЛЯ
    getUserTopologySuperModels(userId) {
        return this.superModels.get(userId) || [];
    }

    // 18. ПОЛУЧИТЬ СТАТИСТИКУ СИСТЕМЫ
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
                mergeVisualizations: this.stats.mergeVisualizations,
                intelligentMerges: this.stats.intelligentMerges,
                topologicalMerges: this.stats.topologicalMerges || 0
            },
            performance: {
                totalSessions: this.stats.totalSessions,
                totalComparisons: this.stats.totalComparisons,
                successfulAlignments: this.stats.successfulAlignments,
                hybridComparisons: this.stats.hybridComparisons,
                hybridSearches: this.stats.hybridSearches,
                mergeVisualizations: this.stats.mergeVisualizations,
                intelligentMerges: this.stats.intelligentMerges,
                topologicalMerges: this.stats.topologicalMerges || 0,
                superModelsCreated: this.stats.superModelsCreated,
                topologySuperModelsCreated: this.stats.topologySuperModelsCreated || 0,
                matcherStats: this.matcher.getStats(),
                topologyMergerStats: this.topologyMerger?.config || {}
            },
            config: {
                dbPath: this.config.dbPath,
                autoAlignment: this.config.autoAlignment,
                autoSave: this.config.autoSave,
                useHybridMode: this.config.useHybridMode,
                hybridSearchThreshold: this.config.hybridSearchThreshold,
                enableMergeVisualization: this.config.enableMergeVisualization,
                enableIntelligentMerge: this.config.enableIntelligentMerge,
                enableSuperModel: this.config.enableSuperModel,
                enableTopologySuperModel: this.config.enableTopologySuperModel,
                topologySimilarityThreshold: this.config.topologySimilarityThreshold,
                superModelConfidenceThreshold: this.config.superModelConfidenceThreshold,
                debug: this.config.debug
            }
        };
    }

    // 19. ПОЛУЧИТЬ МОДЕЛЬ ПО ID
    getModelById(modelId) {
        return this.modelCache.get(modelId) || null;
    }

    // 20. УДАЛИТЬ МОДЕЛЬ
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

            // Удалить из супер-моделей
            if (model.userId && this.superModels.has(model.userId)) {
                const userSuperModels = this.superModels.get(model.userId);
                const index = userSuperModels.findIndex(m => m.id === modelId);
                if (index >= 0) {
                    userSuperModels.splice(index, 1);
                }
            }

            // Обновить статистику
            this.stats.totalModels = this.modelCache.size;
            if (model.hybridFootprint) {
                this.stats.hybridModels = Math.max(0, this.stats.hybridModels - 1);
            }
            if (model.name && model.name.includes('Топологическая')) {
                this.stats.topologySuperModelsCreated = Math.max(0, this.stats.topologySuperModelsCreated - 1);
            }
            this.updateIndexFile();

            console.log(`🗑️ Модель удалена: ${model.name} (${modelId})`);
            if (model.hybridFootprint) {
                console.log(`   🎯 Удалена гибридная модель`);
            }
            if (model.name && model.name.includes('Топологическая')) {
                console.log(`   🏗️ Удалена топологическая модель`);
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

    // 21. ТЕСТ ТОПОЛОГИЧЕСКОГО СЛИЯНИЯ
    async testTopologyMerge(testPointsCount = 30) {
        console.log('🧪 Запускаю тест топологического слияния...');

        // Создать два графа с похожей топологией
        const graph1 = new (require('./simple-graph'))('Тест граф 1');
        const graph2 = new (require('./simple-graph'))('Тест граф 2');

        // Создать структуру (например, крест)
        const center1 = { x: 200, y: 200 };
        const center2 = { x: 250, y: 250 }; // Смещённый центр

        // Граф 1: крест
        const nodes1 = [
            { x: center1.x, y: center1.y }, // Центр
            { x: center1.x - 50, y: center1.y }, // Лево
            { x: center1.x + 50, y: center1.y }, // Право
            { x: center1.x, y: center1.y - 50 }, // Верх
            { x: center1.x, y: center1.y + 50 }  // Низ
        ];

        // Граф 2: тот же крест, но смещённый и немного искажённый
        const nodes2 = [
            { x: center2.x, y: center2.y }, // Центр
            { x: center2.x - 45, y: center2.y }, // Лево
            { x: center2.x + 55, y: center2.y }, // Право
            { x: center2.x, y: center2.y - 55 }, // Верх
            { x: center2.x, y: center2.y + 45 }  // Низ
        ];

        // Добавить узлы
        nodes1.forEach((node, i) => graph1.addNode({ id: `n1_${i}`, x: node.x, y: node.y, confidence: 0.8 }));
        nodes2.forEach((node, i) => graph2.addNode({ id: `n2_${i}`, x: node.x, y: node.y, confidence: 0.8 }));

        // Добавить рёбра (крест)
        const edges1 = [[0,1], [0,2], [0,3], [0,4]];
        const edges2 = [[0,1], [0,2], [0,3], [0,4]];

        edges1.forEach(([from, to], i) =>
            graph1.addEdge({ id: `e1_${i}`, from: `n1_${from}`, to: `n1_${to}`, weight: 1 }));
        edges2.forEach(([from, to], i) =>
            graph2.addEdge({ id: `e2_${i}`, from: `n2_${from}`, to: `n2_${to}`, weight: 1 }));

        console.log(`📊 Созданы тестовые графы:`);
        console.log(`   🟦 Граф 1: ${graph1.nodes.size} узлов, ${graph1.edges.size} рёбер`);
        console.log(`   🟥 Граф 2: ${graph2.nodes.size} узлов, ${graph2.edges.size} рёбер`);

        // Тест топологического слияния
        console.log('\n🏗️ ТЕСТ ТОПОЛОГИЧЕСКОГО СЛИЯНИЯ:');
        const topologyMerger = new TopologyMerger({
            structuralSimilarityThreshold: 0.6,
            preserveTopology: true
        });

        const mergeResult = topologyMerger.mergeGraphs(graph1, graph2);

        if (mergeResult.success) {
            console.log(`✅ Тест успешен!`);
            console.log(`📊 Результаты:`);
            console.log(`   ├─ Метод: ${mergeResult.metrics?.method || 'topology'}`);
            console.log(`   ├─ Структурных соответствий: ${mergeResult.structuralMatches.length}`);
            console.log(`   ├─ Топологическая схожесть: ${mergeResult.structuralSimilarity.toFixed(3)}`);
            console.log(`   ├─ Сохранено топологии: ${mergeResult.metrics?.preservedStructures || 0}%`);
            console.log(`   └─ Узлов в объединённом графе: ${mergeResult.mergedGraph.nodes.size}`);

            // Создать визуализацию
            const vizPath = path.join(this.config.dbPath, 'merge_visualizations', `test_topology_merge_${Date.now()}.png`);

            // Создать временные отпечатки для визуализации
            const footprint1 = new SimpleFootprint({ name: 'Тест граф 1' });
            const footprint2 = new SimpleFootprint({ name: 'Тест граф 2' });
            footprint1.graph = graph1;
            footprint2.graph = graph2;

            await this.mergeVisualizer.visualizeIntelligentMerge(
                footprint1,
                footprint2,
                { similarity: mergeResult.structuralSimilarity, decision: 'same' },
                {
                    outputPath: vizPath,
                    title: 'ТЕСТ ТОПОЛОГИЧЕСКОГО СЛИЯНИЯ',
                    showTransformation: true,
                    showStats: true,
                    showTopology: true
                }
            );

            console.log(`🎨 Визуализация создана: ${vizPath}`);

            return {
                success: true,
                testResults: mergeResult,
                visualization: vizPath,
                stats: {
                    structuralMatches: mergeResult.structuralMatches.length,
                    structuralSimilarity: mergeResult.structuralSimilarity,
                    topologyPreservation: mergeResult.metrics?.preservedStructures || 0
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

    // 22. ИНИЦИАЛИЗАЦИЯ ВИЗУАЛИЗАТОРА
    initializeVisualizer() {
        // Этот метод может остаться пустым или содержать дополнительную логику
    }

    // 23. ПОПЫТКА СОЗДАНИЯ СУПЕР-МОДЕЛИ
    async tryCreateSuperModel(session, userId, bot = null, chatId = null) {
        try {
            console.log('🌟 Проверяю возможность создания супер-модели...');
           
            const userModels = this.getUserModels(userId);
            if (userModels.length < 3) {
                return null;
            }

            // Найти модели с высокой уверенностью
            const highConfidenceModels = userModels
                .filter(m => m.stats.confidence > this.config.superModelConfidenceThreshold)
                .sort((a, b) => b.stats.confidence - a.stats.confidence);

            if (highConfidenceModels.length < 2) {
                return null;
            }

            console.log(`🎯 Найдено ${highConfidenceModels.length} моделей с высокой уверенностью`);

            // Начать с модели с наивысшей уверенностью
            let superModel = highConfidenceModels[0];
            const mergedModels = [superModel];

            for (let i = 1; i < Math.min(highConfidenceModels.length, 4); i++) {
                const currentModel = highConfidenceModels[i];

                console.log(`🧩 Объединяю с "${currentModel.name}"...`);

                const comparison = await superModel.compare(currentModel);

                if (comparison.decision === 'same' && comparison.similarity > 0.7) {
                    const mergeResult = superModel.merge(currentModel);

                    if (mergeResult.success) {
                        mergedModels.push(currentModel);
                        console.log(`✅ Добавлено к супер-модели`);
                    }
                }
            }

            // Сохранить супер-модель
            const superModelName = `Супер-модель_${new Date().toLocaleDateString('ru-RU')}`;
            superModel.name = superModelName;

            const saveResult = this.saveModel(superModel);

            if (!saveResult.success) {
                return null;
            }

            // Создать визуализацию
            const vizPath = path.join(this.config.dbPath, 'merge_visualizations',
                `super_model_${Date.now()}.png`);

            await this.mergeVisualizer.visualizeSuperModel(
                superModel,
                mergedModels,
                vizPath
            );

            // Обновить статистику
            this.stats.superModelsCreated++;

            console.log(`🌟 СУПЕР-МОДЕЛЬ СОЗДАНА!`);
            console.log(`   📊 ${mergedModels.length} моделей объединены`);
            console.log(`   🎯 ${superModel.graph.nodes.size} узлов, ${superModel.graph.edges.size} рёбер`);
            console.log(`   💎 Уверенность: ${Math.round(superModel.stats.confidence * 100)}%`);

            // Отправить в Telegram
            if (bot && chatId && fs.existsSync(vizPath)) {
                setTimeout(async () => {
                    try {
                        const caption = this.mergeVisualizer.createSuperModelCaption?.(
                            superModel, mergedModels
                        ) || `🌟 Супер-модель создана!\n\nОбъединено ${mergedModels.length} моделей`;

                        await bot.sendPhoto(chatId, vizPath, {
                            caption: caption,
                            parse_mode: 'HTML'
                        });

                        console.log(`✅ Визуализация супер-модели отправлена в чат ${chatId}`);

                    } catch (sendError) {
                        console.log('⚠️ Не удалось отправить визуализацию:', sendError.message);
                    }
                }, 500);
            }

            return {
                success: true,
                superModelId: superModel.id,
                superModelName: superModelName,
                mergedModels: mergedModels.length,
                stats: saveResult.stats
            };

        } catch (error) {
            console.log(`❌ Ошибка создания супер-модели: ${error.message}`);
            return null;
        }
    }

    // 24. СОЗДАТЬ СТРУКТУРНУЮ СУПЕР-МОДЕЛЬ
    async createStructuralSuperModel(userId, modelIds = []) {
        console.log(`🏗️ Создаю структурную супер-модель для пользователя ${userId}...`);

        try {
            // Получить модели
            const userModels = this.getUserModels(userId);
            let modelsToUse = userModels;

            if (modelIds.length > 0) {
                modelsToUse = userModels.filter(m => modelIds.includes(m.id));
            }

            if (modelsToUse.length < 3) {
                return {
                    success: false,
                    error: `Недостаточно моделей: ${modelsToUse.length} (минимум 3)`
                };
            }

            // Создать структурную супер-модель
            const superModel = new StructuralSuperModel({
                minModels: 3,
                topologyThreshold: 0.6,
                confidenceThreshold: 0.7
            });

            // Добавить модели
            modelsToUse.forEach(model => superModel.addModel(model));

            const result = await superModel.createSuperModel();

            if (!result || !result.success) {
                return {
                    success: false,
                    error: 'Не удалось создать структурную супер-модель'
                };
            }

            // Сохранить супер-модель
            const superModelFootprint = result.superModel;
            const saveResult = this.saveModel(superModelFootprint);

            if (!saveResult.success) {
                return saveResult;
            }

            // Визуализация
            const vizPath = path.join(this.config.dbPath, 'topology_supermodels',
                `structural_super_model_${Date.now()}.png`);

            await superModel.visualizeSuperModel(vizPath);

            // Сохранить в мапе
            this.structuralSuperModels.set(userId, superModel);

            // Обновить статистику
            this.stats.topologySuperModelsCreated = (this.stats.topologySuperModelsCreated || 0) + 1;

            console.log(`🌟 СТРУКТУРНАЯ СУПЕР-МОДЕЛЬ СОЗДАНА!`);
            console.log(`   📊 ${result.mergedModels} моделей объединены структурно`);
            console.log(`   🏗️ ${result.stats.totalNodes} узлов, ${result.stats.totalEdges} рёбер`);
            console.log(`   🎯 Топологическая целостность: ${result.stats.topologyIntegrity}%`);

            return {
                success: true,
                superModelId: superModelFootprint.id,
                superModelName: superModelFootprint.name,
                stats: result.stats,
                visualization: vizPath,
                type: 'structural'
            };

        } catch (error) {
            console.log(`❌ Ошибка создания структурной супер-модели: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = SimpleFootprintManager;
