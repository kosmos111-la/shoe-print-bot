// modules/footprint/simple-manager.js
// 🎯 ГИБРИД: Векторные паспорта + Старый API для совместимости

const fs = require('fs');
const path = require('path');

class SimpleFootprintManager {
    constructor(options = {}) {
        console.log('🚀 SimpleFootprintManager создан (ГИБРИД: векторы + совместимость)');

        // 🔥 НАСТРОЙКИ
        this.config = {
            dbPath: options.dbPath || './data/footprints',
            autoSave: options.autoSave !== false,
            debug: options.debug || false,
            minPointsForFootprint: options.minPointsForFootprint || 3,
            geometricSimilarityThreshold: options.geometricSimilarityThreshold || 0.6,
            enableVisualization: options.enableVisualization !== false,
            ...options
        };

        // 🔥 ЗАГРУЖАЕМ ВЕКТОРНЫЙ АЛГОРИТМ
        let VectorAlgorithm;
        try {
            VectorAlgorithm = require('./clean/vector-algorithm');
            console.log('✅ Векторный алгоритм загружен');
        } catch (error) {
            console.log(`❌ Не удалось загрузить векторный алгоритм: ${error.message}`);
            // Фаллбэк
            VectorAlgorithm = class {
                createGeometricPassports(points) { return points.map(p => ({ hash: `fallback_${p.id}` })); }
                comparePassports() { return { similarity: 0, isSame: false }; }
            };
        }

        this.vectorAlgorithm = new VectorAlgorithm({
            neighborCount: 3,
            anglePrecision: 5,
            distancePrecision: 10,
            minSimilarity: this.config.geometricSimilarityThreshold,
            debug: this.config.debug
        });

        // 🔥 ЗАГРУЖАЕМ ТРЕКЕР ПАСПОРТОВ
        let PointTracker;
        try {
            PointTracker = require('./point-tracker');
            console.log('✅ PointTracker загружен');
        } catch (error) {
            console.log(`❌ Не удалось загрузить PointTracker: ${error.message}`);
            // Фаллбэк
            PointTracker = class {
                processGeometricPassports() { return { added: 0, confirmed: 0 }; }
                getStats() { return { totalPassports: 0 }; }
                getAllPoints() { return []; }
            };
        }

        // 🔥 СТРУКТУРЫ ДАННЫХ
        this.pointTracker = new PointTracker({
            minPassportConfirmations: 2,
            debug: this.config.debug
        });

        this.userSessions = new Map(); // userId -> { session }
       
        // 🔥 ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
        this.graph = {
            nodes: new Map(),
            edges: new Map(),
            name: 'Гибридная система'
        };
       
        // 🔥 ВИЗУАЛИЗАЦИЯ
        let ClusterVisualizer;
        try {
            ClusterVisualizer = require('./visualizations/cluster-visualizer');
            this.visualizer = new ClusterVisualizer({
                debug: this.config.debug,
                outputDir: path.join(this.config.dbPath, 'visualizations')
            });
            console.log('✅ Визуализатор загружен');
        } catch (error) {
            console.log(`⚠️ Визуализация не доступна: ${error.message}`);
            this.visualizer = null;
        }

        // 🔥 СТАТИСТИКА
        this.systemStats = {
            totalUsers: 0,
            totalFootprints: 0,
            totalPassports: 0,
            totalPhotosProcessed: 0,
            algorithm: 'geometric_passports_hybrid',
            lastActivity: new Date()
        };

        // 🔥 СОЗДАЕМ ДИРЕКТОРИИ
        this.ensureDirectories();

        console.log('✅ SimpleFootprintManager инициализирован (гибридный)');
    }

    // ============================================
    // 🔥 СТАРЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ С main.js
    // ============================================

    /**
     * СТАРЫЙ МЕТОД: Получить активную сессию
     * (нужен для main.js)
     */
    getActiveSession(userId) {
        console.log(`[Совместимость] getActiveSession для ${userId}`);
        return this.getOrCreateSession(userId.toString());
    }

    /**
     * СТАРЫЙ МЕТОД: Добавить фото в сессию
     * (главный метод, который вызывает main.js)
     */
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`[Совместимость] addPhotoToSession для ${userId}`);
       
        try {
            // 1. Извлекаем точки из анализа
            const points = this.extractPointsFromAnalysis(analysis);
           
            if (points.length < this.config.minPointsForFootprint) {
                return {
                    success: false,
                    error: `Слишком мало точек: ${points.length}`,
                    nodesAdded: 0
                };
            }

            console.log(`📊 Извлечено ${points.length} точек`);

            // 2. Создаем геометрические паспорта
            const passports = this.vectorAlgorithm.createGeometricPassports(points, `user_${userId}`);
            console.log(`🎯 Создано ${passports.length} геометрических паспортов`);

            // 3. Обрабатываем через трекер
            const trackerResult = this.pointTracker.processGeometricPassports(passports, {
                userId: userId.toString(),
                photoId: photoInfo.photoId || `photo_${Date.now()}`,
                timestamp: new Date(),
                ...photoInfo
            });

            // 4. Получаем или создаем сессию
            const session = this.getOrCreateSession(userId.toString());
            session.lastActivity = new Date();
            session.photos.push({
                id: photoInfo.photoId || `photo_${Date.now()}`,
                timestamp: new Date(),
                pointsCount: points.length,
                passportsCount: passports.length,
                trackerResult: trackerResult
            });

            // 5. Создаем визуализацию если включена
            let visualizationResult = null;
            if (this.config.enableVisualization && this.visualizer) {
                visualizationResult = await this.createVisualization(session, trackerResult, photoInfo);
            }

            // 6. Вычисляем схожесть
            const similarity = this.calculateSimilarity(trackerResult);
            const isSameFootprint = similarity >= this.config.geometricSimilarityThreshold;

            // 7. Формируем результат в СТАРОМ формате
            const result = {
                success: true,
                isNewSession: !this.userSessions.has(userId.toString()),
                similarity: similarity,
                decision: isSameFootprint ? 'same' : 'different',
                nodesAdded: trackerResult.added,
                totalNodes: this.pointTracker.points.size,
                sessionId: session.userId,
                hasTemplate: true,
                hasVisualization: !!visualizationResult,
                vizPath: visualizationResult?.path,
                algorithm: 'geometric_passports_hybrid',
                message: this.generateMessage(trackerResult, similarity, isSameFootprint),
                trackerResult: trackerResult,
                pointsCount: points.length,
                passportsCount: passports.length
            };

            console.log(`✅ Гибридный анализ: ${result.message}`);
            console.log(`📊 Сходство: ${(similarity * 100).toFixed(1)}%`);

            // 8. Отправляем визуализацию в Telegram если есть бот
            if (bot && chatId && visualizationResult?.path) {
                await this.sendTelegramVisualization(bot, chatId, visualizationResult.path, result);
            }

            // 9. Обновляем статистику
            this.updateSystemStats();

            // 10. Сохраняем если нужно
            if (this.config.autoSave) {
                this.saveSession(userId.toString());
            }

            return result;

        } catch (error) {
            console.error(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            return {
                success: false,
                error: error.message,
                nodesAdded: 0
            };
        }
    }

    /**
     * СТАРЫЙ МЕТОД: Получить информацию о сессии
     */
    getSessionInfo(userId) {
        const session = this.userSessions.get(userId.toString());
        return session ? {
            userId: session.userId,
            photosCount: session.photos.length,
            lastActivity: session.lastActivity,
            footprintsCount: session.footprints.length
        } : null;
    }

    /**
     * СТАРЫЙ МЕТОД: Проверить наличие сессии
     */
    hasSession(userId) {
        return this.userSessions.has(userId.toString());
    }

    /**
     * СТАРЫЙ МЕТОД: Обновить время активности
     */
    updateLastActivity(userId) {
        const session = this.userSessions.get(userId.toString());
        if (session) {
            session.lastActivity = new Date();
            return true;
        }
        return false;
    }

    // ============================================
    // 🔥 НОВЫЕ МЕТОДЫ ДЛЯ ВЕКТОРНЫХ ПАСПОРТОВ
    // ============================================

    /**
     * НОВЫЙ МЕТОД: Добавить анализ фото (векторная версия)
     */
    async addPhotoAnalysis(userId, analysis, photoInfo = {}) {
        console.log(`📸 Векторный анализ для пользователя ${userId}`);
       
        try {
            const points = this.extractPointsFromAnalysis(analysis);
           
            if (points.length < this.config.minPointsForFootprint) {
                return {
                    success: false,
                    error: `Слишком мало точек: ${points.length}`
                };
            }

            const passports = this.vectorAlgorithm.createGeometricPassports(points, `user_${userId}`);
            const trackerResult = this.pointTracker.processGeometricPassports(passports, {
                userId: userId,
                ...photoInfo
            });

            const session = this.getOrCreateSession(userId);
            session.lastActivity = new Date();
            session.photos.push({
                id: photoInfo.photoId || `photo_${Date.now()}`,
                timestamp: new Date(),
                pointsCount: points.length,
                passportsCount: passports.length
            });

            const similarity = this.calculateSimilarity(trackerResult);
            const isSameFootprint = similarity >= this.config.geometricSimilarityThreshold;

            return {
                success: true,
                userId: userId,
                points: points.length,
                passports: passports.length,
                trackerResult: trackerResult,
                similarity: similarity,
                isSameFootprint: isSameFootprint,
                decision: isSameFootprint ? 'same_footprint' : 'new_footprint',
                message: this.generateMessage(trackerResult, similarity, isSameFootprint)
            };

        } catch (error) {
            console.error(`❌ Ошибка векторного анализа: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================
    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================

    /**
     * Извлечь точки из анализа
     */
    extractPointsFromAnalysis(analysis) {
        const points = [];
       
        if (!analysis || !analysis.predictions) {
            console.log('⚠️ Анализ не содержит predictions');
            return points;
        }

        const predictions = analysis.predictions || [];
       
        predictions.forEach((pred, index) => {
            if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);
               
                points.push({
                    id: `pt_${index}_${Date.now()}`,
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2,
                    confidence: pred.confidence || 0.5,
                    originalPoints: pred.points,
                    source: 'analysis',
                    timestamp: new Date()
                });
            }
        });

        return points.filter(p =>
            p && typeof p.x === 'number' && typeof p.y === 'number' &&
            !isNaN(p.x) && !isNaN(p.y)
        );
    }

    /**
     * Получить или создать сессию
     */
    getOrCreateSession(userId) {
        if (!this.userSessions.has(userId)) {
            const session = {
                userId: userId,
                createdAt: new Date(),
                lastActivity: new Date(),
                photos: [],
                footprints: [],
                statistics: {
                    totalPhotos: 0,
                    totalPoints: 0,
                    totalPassports: 0,
                    confirmedPatterns: 0
                }
            };
           
            this.userSessions.set(userId, session);
            this.systemStats.totalUsers++;
           
            console.log(`🆕 Создана сессия для пользователя ${userId}`);
        }
       
        return this.userSessions.get(userId);
    }

    /**
     * Создать визуализацию
     */
    async createVisualization(session, trackerResult, photoInfo) {
        try {
            if (!this.visualizer) return null;
           
            const points = this.pointTracker.getAllPoints();
           
            if (points.length === 0) {
                console.log('⚠️ Нет точек для визуализации');
                return null;
            }

            const passports = this.pointTracker.getPassportsForVisualization();
           
            const vizData = {
                points: points,
                passports: passports,
                patterns: this.extractPatternsFromPassports(passports)
            };

            const vizResult = await this.visualizer.visualizeGeometricPassports(
                vizData,
                {
                    width: 1200,
                    height: 800,
                    filename: `user_${session.userId}_${Date.now()}.png`
                }
            );

            console.log(`🎨 Визуализация создана: ${vizResult?.path || 'нет пути'}`);
           
            session.lastVisualization = {
                path: vizResult?.path,
                timestamp: new Date(),
                pointsCount: points.length
            };

            return vizResult;

        } catch (error) {
            console.log(`⚠️ Ошибка визуализации: ${error.message}`);
            return null;
        }
    }

    /**
     * Извлечь паттерны из паспортов
     */
    extractPatternsFromPassports(passports) {
        const patternMap = new Map();
       
        passports.forEach(passport => {
            const patternType = passport.patternType || 'unknown';
            if (!patternMap.has(patternType)) {
                patternMap.set(patternType, {
                    type: patternType,
                    confirmations: 0,
                    passports: []
                });
            }
           
            const pattern = patternMap.get(patternType);
            pattern.confirmations += passport.confirmations || 1;
            pattern.passports.push(passport.hash);
        });

        return Array.from(patternMap.values()).map(pattern => ({
            type: pattern.type,
            confirmations: pattern.confirmations,
            passportCount: pattern.passports.length
        }));
    }

    /**
     * Вычислить схожесть
     */
    calculateSimilarity(trackerResult) {
        const { added, confirmed } = trackerResult;
        const total = added + confirmed;
       
        if (total === 0) return 0;
       
        return confirmed / total;
    }

    /**
     * Создать сообщение
     */
    generateMessage(trackerResult, similarity, isSameFootprint) {
        const { added, confirmed } = trackerResult;
       
        if (isSameFootprint) {
            return `✅ Та же обувь! Подтверждено ${confirmed} геометрических паттернов (сходство: ${(similarity * 100).toFixed(1)}%)`;
        } else if (added > 0) {
            return `🆕 Новые паттерны! Добавлено ${added} новых геометрических паттернов`;
        } else {
            return `⚠️ Мало совпадений. Подтверждено ${confirmed} паттернов`;
        }
    }

    /**
     * Отправить визуализацию в Telegram
     */
    async sendTelegramVisualization(bot, chatId, vizPath, result) {
        try {
            if (!fs.existsSync(vizPath)) {
                console.log(`⚠️ Файл визуализации не найден: ${vizPath}`);
                return;
            }

            const caption = `🎯 ${result.message}\n` +
                          `📊 Сходство: ${(result.similarity * 100).toFixed(1)}%\n` +
                          `🔷 Паттернов: ${result.passportsCount}\n` +
                          `🎯 Алгоритм: ${result.algorithm}`;

            await bot.sendPhoto(chatId, vizPath, {
                caption: this.cleanMarkdown(caption),
                parse_mode: 'HTML'
            });

            console.log('✅ Визуализация отправлена в Telegram');

        } catch (error) {
            console.log(`❌ Ошибка отправки в Telegram: ${error.message}`);
        }
    }

    /**
     * Очистить Markdown
     */
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

    /**
     * Обновить системную статистику
     */
    updateSystemStats() {
        const trackerStats = this.pointTracker.getStats();
       
        this.systemStats.totalPassports = trackerStats.totalPassports;
        this.systemStats.totalFootprints = this.userSessions.size;
        this.systemStats.totalPhotosProcessed = Array.from(this.userSessions.values())
            .reduce((sum, session) => sum + session.photos.length, 0);
        this.systemStats.lastActivity = new Date();
    }

    /**
     * Получить статистику
     */
    getStats() {
        const userStats = Array.from(this.userSessions.entries()).map(([userId, session]) => ({
            userId: userId,
            photos: session.photos.length,
            lastActivity: session.lastActivity,
            footprints: session.footprints.length
        }));

        const trackerStats = this.pointTracker.getStats();
       
        return {
            ...this.systemStats,
            lastActivity: this.systemStats.lastActivity.toLocaleString('ru-RU'),
            users: userStats,
            tracker: trackerStats,
            algorithm: 'geometric_passports_hybrid'
        };
    }

    /**
     * Сохранить сессию
     */
    saveSession(userId) {
        try {
            const session = this.userSessions.get(userId);
            if (!session) return false;
           
            const sessionsDir = path.join(this.config.dbPath, 'sessions');
            if (!fs.existsSync(sessionsDir)) {
                fs.mkdirSync(sessionsDir, { recursive: true });
            }
           
            const filename = `session_${userId}_${Date.now()}.json`;
            const filepath = path.join(sessionsDir, filename);
           
            const data = {
                userId: userId,
                session: session,
                pointTracker: this.pointTracker.toJSON(),
                savedAt: new Date().toISOString()
            };
           
            fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
           
            console.log(`💾 Сессия сохранена: ${filepath}`);
            return true;
           
        } catch (error) {
            console.log(`⚠️ Ошибка сохранения сессии: ${error.message}`);
            return false;
        }
    }

    /**
     * Создать директории
     */
    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'sessions'),
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'reports'),
            path.join(this.config.dbPath, 'logs')
        ];
       
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Создана директория: ${dir}`);
            }
        });
    }

    /**
     * ДЛЯ СОВМЕСТИМОСТИ: Сравнить два набора точек
     */
    async comparePoints(points1, points2, options = {}) {
        console.log(`🔍 [Совместимость] Сравниваю точки`);
       
        try {
            const passports1 = this.vectorAlgorithm.createGeometricPassports(points1, 'set1');
            const passports2 = this.vectorAlgorithm.createGeometricPassports(points2, 'set2');
           
            const result = this.vectorAlgorithm.comparePassports(
                passports1,
                passports2,
                { minSimilarity: options.minSimilarity || this.config.geometricSimilarityThreshold }
            );
           
            console.log(`📊 Результат: ${(result.similarity * 100).toFixed(1)}% сходства`);
           
            return {
                similarity: result.similarity,
                isSame: result.isSame,
                decision: result.isSame ? 'same' : 'different',
                matches: result.matches?.length || 0,
                algorithm: 'geometric_passports_hybrid'
            };
           
        } catch (error) {
            console.error(`❌ Ошибка сравнения: ${error.message}`);
            return {
                similarity: 0,
                isSame: false,
                decision: 'error'
            };
        }
    }

    /**
     * ДЛЯ СОВМЕСТИМОСТИ: Показать статистику
     */
    showStats() {
        const stats = this.getStats();
        const trackerStats = this.pointTracker.getStats();
       
        console.log(`\n📊 ГИБРИДНАЯ СИСТЕМА (векторные паспорта):`);
        console.log(`├─ Пользователей: ${stats.users?.length || 0}`);
        console.log(`├─ Всего фото: ${stats.totalPhotosProcessed}`);
        console.log(`├─ Всего паспортов: ${trackerStats.totalPassports}`);
        console.log(`├─ Подтвержденных паспортов: ${trackerStats.confirmedPassports}`);
        console.log(`└─ Алгоритм: ${stats.algorithm}`);
    }
}

module.exports = SimpleFootprintManager;
