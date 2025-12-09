// modules/footprint/simple-manager.js
// МЕНЕДЖЕР СИСТЕМЫ ЦИФРОВЫХ ОТПЕЧАТКОВ - УПРАВЛЕНИЕ ВСЕМ (С ГИБРИДНОЙ ПОДДЕРЖКОЙ)

const fs = require('fs');
const path = require('path');
const SimpleFootprint = require('./simple-footprint');
const SimpleGraphMatcher = require('./simple-matcher');
const HybridFootprint = require('./hybrid-footprint');

class SimpleFootprintManager {
    constructor(options = {}) {
        // Конфигурация
        this.config = {
            dbPath: options.dbPath || './data/footprints',
            autoAlignment: options.autoAlignment !== false,
            autoSave: options.autoSave !== false,
            maxModelsPerUser: options.maxModelsPerUser || 50,
            debug: options.debug || false,
            useHybridMode: options.useHybridMode !== false, // Новая опция для гибридного режима
            hybridSearchThreshold: options.hybridSearchThreshold || 0.6,
            ...options
        };

        // Инициализация компонентов
        this.matcher = new SimpleGraphMatcher({
            debug: this.config.debug,
            enableDetailedMatch: true
        });

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
                    version: '1.1', // Обновили версию
                    created: new Date().toISOString(),
                    totalModels: 0,
                    hybridModels: 0,
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
            useHybrid: this.config.useHybridMode, // Сохраняем настройку гибридного режима для сессии
            stats: {
                photoCount: 0,
                analysisCount: 0,
                autoAlignments: 0,
                mergedCount: 0,
                hybridComparisons: 0
            }
        };

        this.userSessions.set(userId, session);
        this.activeSessions.set(sessionId, session);
        this.stats.totalSessions++;

        console.log(`🔄 Создана сессия "${name}" для пользователя ${userId}`);
        if (session.useHybrid) {
            console.log(`   🎯 Гибридный режим: ВКЛЮЧЕН`);
        }

        return session;
    }

    // 4. ПОЛУЧИТЬ АКТИВНУЮ СЕССИЮ ПОЛЬЗОВАТЕЛЯ
    getActiveSession(userId) {
        return this.userSessions.get(userId);
    }

    // 5. ДОБАВИТЬ ФОТО В СЕССИЮ С АВТОСОВМЕЩЕНИЕМ
    async addPhotoToSession(userId, analysis, photoInfo = {}) {
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

        // АВТОСОВМЕЩЕНИЕ
        let alignmentResult = null;
        let mergeResult = null;

        if (this.config.autoAlignment && session.currentFootprint) {
            console.log(`🎯 Запускаю автосовмещение...`);

            // Сравнить с текущим отпечатком в сессии
            const comparison = session.currentFootprint.compare(tempFootprint);
           
            if (tempFootprint.hybridFootprint && session.currentFootprint.hybridFootprint) {
                session.stats.hybridComparisons++;
            }

            if (comparison.decision === 'same') {
                console.log(`✅ Автосовмещение: тот же след (similarity: ${comparison.similarity})`);

                // СОЗДАЕМ ВИЗУАЛИЗАЦИЮ АВТОСОВМЕЩЕНИЯ (если включен debug)
                if (this.graphVisualizer && this.config.debug) {
                    setTimeout(async () => {
                        try {
                            const vizPath = await this.graphVisualizer.visualizeComparison(
                                session.currentFootprint.graph,
                                tempFootprint.graph,
                                comparison,
                                { filename: `automerge_${session.id.slice(0, 8)}.png` }
                            );

                            // Логируем создание визуализации
                            if (vizPath && fs.existsSync(vizPath)) {
                                console.log(`🎨 Визуализация автосовмещения создана: ${vizPath}`);
                            }
                        } catch (vizError) {
                            console.log('⚠️ Не удалось создать визуализацию автосовмещения:', vizError.message);
                        }
                    }, 1000);
                }

                // Объединить отпечатки
                mergeResult = session.currentFootprint.merge(tempFootprint);

                if (mergeResult.success) {
                    session.stats.autoAlignments++;
                    session.stats.mergedCount += mergeResult.mergedPhotos;

                    alignmentResult = {
                        success: true,
                        similarity: comparison.similarity,
                        decision: 'merged',
                        mergedNodes: mergeResult.mergedPhotos,
                        totalNodes: session.currentFootprint.graph.nodes.size,
                        method: comparison.method || 'graph'
                    };
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
            footprintId: session.currentFootprint?.id
        });

        session.stats.analysisCount++;

        const result = {
            success: true,
            nodesAdded: addResult.added,
            totalNodes: session.currentFootprint?.graph?.nodes?.size || 0,
            alignment: alignmentResult,
            sessionStats: session.stats,
            hasHybrid: tempFootprint.hybridFootprint !== null
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
                hybridComparisons: session.stats.hybridComparisons
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

    // 12. НАЙТИ ПОХОЖИЕ МОДЕЛИ - ОБНОВЛЕННЫЙ
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
                modelCache: this.modelCache.size
            },
            performance: {
                totalSessions: this.stats.totalSessions,
                totalComparisons: this.stats.totalComparisons,
                successfulAlignments: this.stats.successfulAlignments,
                hybridComparisons: this.stats.hybridComparisons,
                hybridSearches: this.stats.hybridSearches,
                matcherStats: this.matcher.getStats()
            },
            config: {
                dbPath: this.config.dbPath,
                autoAlignment: this.config.autoAlignment,
                autoSave: this.config.autoSave,
                useHybridMode: this.config.useHybridMode,
                hybridSearchThreshold: this.config.hybridSearchThreshold,
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
            console.log(`⚠️ Ошибка очистки автосохранений: ${error.message}`);
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
}

module.exports = SimpleFootprintManager;
