// modules/footprint/simple-manager.js
// 🔥 УПРОЩЕННЫЙ МЕНЕДЖЕР С ГЕОМЕТРИЧЕСКИМИ ПАСПОРТАМИ

const fs = require('fs');
const path = require('path');

class SimpleFootprintManager {
    constructor(options = {}) {
        console.log('🚀 SimpleFootprintManager создан (геометрические паспорта)');

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
            };
        }

        // 🔥 СТРУКТУРЫ ДАННЫХ
        this.pointTracker = new PointTracker({
            minPassportConfirmations: 2,
            debug: this.config.debug
        });

        this.userSessions = new Map(); // userId -> { session }
        this.footprints = new Map(); // footprintId -> footprint
       
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
            algorithm: 'geometric_passports_v1.0',
            lastActivity: new Date()
        };

        // 🔥 СОЗДАЕМ ДИРЕКТОРИИ
        this.ensureDirectories();

        console.log('✅ SimpleFootprintManager инициализирован');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Добавить анализ фото
    async addPhotoAnalysis(userId, analysis, photoInfo = {}) {
        console.log(`\n📸 Добавляю анализ фото для пользователя ${userId}`);

        try {
            // 1. Извлекаем точки из анализа
            const points = this.extractPointsFromAnalysis(analysis);
           
            if (points.length < this.config.minPointsForFootprint) {
                return {
                    success: false,
                    error: `Слишком мало точек: ${points.length} (минимум ${this.config.minPointsForFootprint})`
                };
            }

            console.log(`📊 Извлечено ${points.length} точек`);

            // 2. Создаем геометрические паспорта
            const passports = this.vectorAlgorithm.createGeometricPassports(points, `user_${userId}`);
           
            console.log(`🎯 Создано ${passports.length} геометрических паспортов`);

            // 3. Обрабатываем паспорта через трекер
            const trackerResult = this.pointTracker.processGeometricPassports(passports, {
                userId: userId,
                photoId: photoInfo.photoId || `photo_${Date.now()}`,
                timestamp: new Date(),
                ...photoInfo
            });

            // 4. Получаем или создаем сессию
            const session = this.getOrCreateSession(userId);
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

            // 6. Обновляем статистику
            this.updateSystemStats();

            // 7. Сохраняем если нужно
            if (this.config.autoSave) {
                this.saveSession(userId);
            }

            // 8. Формируем результат
            const similarity = this.calculateSimilarity(trackerResult);
            const isSameFootprint = similarity >= this.config.geometricSimilarityThreshold;
           
            const result = {
                success: true,
                userId: userId,
                points: points.length,
                passports: passports.length,
                trackerResult: trackerResult,
                similarity: similarity,
                isSameFootprint: isSameFootprint,
                decision: isSameFootprint ? 'same_footprint' : 'new_footprint',
                visualization: visualizationResult,
                message: this.generateMessage(trackerResult, similarity, isSameFootprint)
            };

            console.log(`✅ Анализ добавлен: ${result.message}`);
            console.log(`📊 Сходство: ${(similarity * 100).toFixed(1)}%`);

            return result;

        } catch (error) {
            console.error(`❌ Ошибка добавления фото: ${error.message}`);
            return {
                success: false,
                error: error.message,
                userId: userId
            };
        }
    }

    // 🔥 ИЗВЛЕЧЕНИЕ ТОЧЕК ИЗ АНАЛИЗА
    extractPointsFromAnalysis(analysis) {
        const points = [];
       
        if (!analysis || !analysis.predictions) {
            console.log('⚠️ Анализ не содержит predictions');
            return points;
        }

        const predictions = analysis.predictions || [];
       
        predictions.forEach((pred, index) => {
            if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                // Берем центр bounding box или первого точки
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

    // 🔥 ПОЛУЧИТЬ ИЛИ СОЗДАТЬ СЕССИЮ
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

    // 🔥 СОЗДАТЬ ВИЗУАЛИЗАЦИЮ
    async createVisualization(session, trackerResult, photoInfo) {
        try {
            if (!this.visualizer) return null;
           
            // Получаем все точки для визуализации
            const points = this.pointTracker.getAllPoints();
           
            if (points.length === 0) {
                console.log('⚠️ Нет точек для визуализации');
                return null;
            }

            // Создаем фейковый footprint для визуализации
            const fakeFootprint = {
                id: `viz_${session.userId}_${Date.now()}`,
                name: `Визуализация_${session.userId}`,
                pointTracker: this.pointTracker,
                getTransformation: () => ({ rotationAngle: 0, isMirrored: false }),
                metadata: {
                    userId: session.userId,
                    timestamp: new Date(),
                    photoInfo: photoInfo
                }
            };

            // Создаем визуализацию
            const vizResult = await this.visualizer.visualizeSingleFootprintConfirmations(
                fakeFootprint,
                { width: 1200, height: 800, filename: `user_${session.userId}_${Date.now()}.png` }
            );

            console.log(`🎨 Визуализация создана: ${vizResult?.path || 'нет пути'}`);
           
            // Сохраняем в сессии
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

    // 🔥 ВЫЧИСЛИТЬ СХОДСТВО
    calculateSimilarity(trackerResult) {
        const { added, confirmed } = trackerResult;
        const total = added + confirmed;
       
        if (total === 0) return 0;
       
        // Чем больше подтверждений, тем выше сходство
        return confirmed / total;
    }

    // 🔥 СОЗДАТЬ СООБЩЕНИЕ
    generateMessage(trackerResult, similarity, isSameFootprint) {
        const { added, confirmed } = trackerResult;
       
        if (isSameFootprint) {
            return `✅ Та же обувь! Подтверждено ${confirmed} паттернов (сходство: ${(similarity * 100).toFixed(1)}%)`;
        } else if (added > 0) {
            return `🆕 Новые паттерны! Добавлено ${added} новых геометрических паттернов`;
        } else {
            return `⚠️ Мало совпадений. Подтверждено ${confirmed} паттернов`;
        }
    }

    // 🔥 ОБНОВИТЬ СИСТЕМНУЮ СТАТИСТИКУ
    updateSystemStats() {
        const trackerStats = this.pointTracker.getStats();
       
        this.systemStats.totalPassports = trackerStats.totalPassports;
        this.systemStats.totalFootprints = this.userSessions.size;
        this.systemStats.totalPhotosProcessed = Array.from(this.userSessions.values())
            .reduce((sum, session) => sum + session.photos.length, 0);
        this.systemStats.lastActivity = new Date();
    }

    // 🔥 ПОЛУЧИТЬ СТАТИСТИКУ
    getStats() {
        const userStats = Array.from(this.userSessions.entries()).map(([userId, session]) => ({
            userId: userId,
            photos: session.photos.length,
            lastActivity: session.lastActivity,
            footprints: session.footprints.length
        }));

        const trackerStats = this.pointTracker.getStats();
       
        // Анализ паттернов
        const patternStats = {
            equilateral_triangles: this.pointTracker.findPassportsByPattern('equilateral_triangle').length,
            right_triangles: this.pointTracker.findPassportsByPattern('right_triangle').length,
            dense_clusters: this.pointTracker.findPassportsByPattern('dense_cluster').length,
            linear_patterns: this.pointTracker.findPassportsByPattern('linear_pattern').length,
            complex_patterns: this.pointTracker.findPassportsByPattern('complex_pattern').length
        };

        return {
            ...this.systemStats,
            lastActivity: this.systemStats.lastActivity.toLocaleString('ru-RU'),
            users: userStats,
            tracker: trackerStats,
            patterns: patternStats,
            pointsByConfirmations: trackerStats.pointsByConfirmations,
            algorithm: 'geometric_passports'
        };
    }

    // 🔥 СРАВНИТЬ ДВА НАБОРА ТОЧЕК
    async comparePoints(points1, points2, options = {}) {
        console.log(`🔍 Сравниваю ${points1.length} vs ${points2.length} точек`);
       
        try {
            // Создаем паспорта
            const passports1 = this.vectorAlgorithm.createGeometricPassports(points1, 'set1');
            const passports2 = this.vectorAlgorithm.createGeometricPassports(points2, 'set2');
           
            // Сравниваем паспорта
            const result = this.vectorAlgorithm.comparePassports(
                passports1,
                passports2,
                {
                    minSimilarity: options.minSimilarity || this.config.geometricSimilarityThreshold
                }
            );
           
            // Обрабатываем через трекер для обновления подтверждений
            if (result.isSame) {
                this.pointTracker.processGeometricPassports(passports1, { sourceId: 'comparison_set1' });
                this.pointTracker.processGeometricPassports(passports2, { sourceId: 'comparison_set2' });
            }
           
            console.log(`📊 Результат сравнения: ${(result.similarity * 100).toFixed(1)}% сходства`);
            console.log(`🎯 Решение: ${result.isSame ? '✅ ОДНА ОБУВЬ' : '❌ РАЗНАЯ ОБУВЬ'}`);
           
            return {
                similarity: result.similarity,
                isSame: result.isSame,
                decision: result.isSame ? 'same' : 'different',
                matches: result.matches?.length || 0,
                stats: result.stats,
                algorithm: 'geometric_passports'
            };
           
        } catch (error) {
            console.error(`❌ Ошибка сравнения: ${error.message}`);
            return {
                similarity: 0,
                isSame: false,
                decision: 'error',
                error: error.message
            };
        }
    }

    // 🔥 СОХРАНИТЬ СЕССИЮ
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

    // 🔥 ЗАГРУЗИТЬ СЕССИЮ
    loadSession(userId, filepath = null) {
        try {
            let targetFile = filepath;
           
            if (!targetFile) {
                // Ищем последнюю сессию пользователя
                const sessionsDir = path.join(this.config.dbPath, 'sessions');
                if (!fs.existsSync(sessionsDir)) return false;
               
                const files = fs.readdirSync(sessionsDir)
                    .filter(f => f.includes(`session_${userId}`) && f.endsWith('.json'))
                    .sort()
                    .reverse();
               
                if (files.length === 0) return false;
               
                targetFile = path.join(sessionsDir, files[0]);
            }
           
            const data = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
           
            // Восстанавливаем сессию
            this.userSessions.set(userId, data.session);
           
            // Восстанавливаем трекер
            this.pointTracker = PointTracker.fromJSON(data.pointTracker);
           
            console.log(`📂 Сессия загружена: ${targetFile}`);
            return true;
           
        } catch (error) {
            console.log(`⚠️ Ошибка загрузки сессии: ${error.message}`);
            return false;
        }
    }

    // 🔥 ОЧИСТИТЬ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ
    clearUserData(userId) {
        if (this.userSessions.has(userId)) {
            this.userSessions.delete(userId);
            console.log(`🧹 Данные пользователя ${userId} очищены`);
            return true;
        }
        return false;
    }

    // 🔥 ЭКСПОРТ ДАННЫХ
    exportData(options = {}) {
        const data = {
            systemStats: this.systemStats,
            userSessions: Array.from(this.userSessions.entries()),
            pointTracker: this.pointTracker.toJSON(),
            config: this.config,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
       
        if (options.includePassports) {
            data.passports = this.pointTracker.getPassportsForVisualization();
        }
       
        if (options.includePoints) {
            data.points = this.pointTracker.getAllPoints();
        }
       
        return data;
    }

    // 🔥 СОЗДАТЬ ОТЧЕТ
    generateReport() {
        const stats = this.getStats();
        const trackerStats = this.pointTracker.getStats();
       
        const report = `
🏗️ ОТЧЕТ СИСТЕМЫ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ
══════════════════════════════════════════

📊 СИСТЕМНАЯ СТАТИСТИКА:
• Всего пользователей: ${stats.users?.length || 0}
• Всего фото обработано: ${stats.totalPhotosProcessed}
• Всего паспортов: ${stats.tracker?.totalPassports || 0}
• Подтвержденных паспортов: ${stats.tracker?.confirmedPassports || 0}

🎯 ГЕОМЕТРИЧЕСКИЕ ПАТТЕРНЫ:
• Равносторонние треугольники: ${stats.patterns?.equilateral_triangles || 0}
• Прямоугольные треугольники: ${stats.patterns?.right_triangles || 0}
• Плотные кластеры: ${stats.patterns?.dense_clusters || 0}
• Линейные паттерны: ${stats.patterns?.linear_patterns || 0}
• Сложные паттерны: ${stats.patterns?.complex_patterns || 0}

📈 ПОДТВЕРЖДЕНИЯ ТОЧЕК:
• 1 подтверждение: ${stats.pointsByConfirmations?.['1'] || 0}
• 2 подтверждения: ${stats.pointsByConfirmations?.['2'] || 0}
• 3+ подтверждений: ${stats.pointsByConfirmations?.['3+'] || 0}

🔧 АЛГОРИТМ: ${stats.algorithm}
📅 Последняя активность: ${stats.lastActivity}

══════════════════════════════════════════
Отчет создан: ${new Date().toLocaleString('ru-RU')}
        `.trim();
       
        return report;
    }

    // 🔥 СОХРАНИТЬ ОТЧЕТ
    saveReport(filename = null) {
        const report = this.generateReport();
        const reportsDir = path.join(this.config.dbPath, 'reports');
       
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
       
        const targetFile = filename || `report_${Date.now()}.txt`;
        const filepath = path.join(reportsDir, targetFile);
       
        fs.writeFileSync(filepath, report, 'utf8');
       
        console.log(`📄 Отчет сохранен: ${filepath}`);
        return filepath;
    }

    // 🔥 СОЗДАТЬ ДИРЕКТОРИИ
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
}

module.exports = SimpleFootprintManager;
