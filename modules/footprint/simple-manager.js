// modules/footprint/simple-manager.js
// 🔥 ИЗМЕНЕННЫЙ ДЛЯ ИСПОЛЬЗОВАНИЯ АККУМУЛЯЦИОННОЙ МОДЕЛИ

const fs = require('fs');
const path = require('path');

// 🔥 ИМПОРТ АККУМУЛЯЦИОННОЙ МОДЕЛИ
let AccumulativeModel;
try {
    AccumulativeModel = require('./accumulative-model');
    console.log('✅ Аккумуляционная модель загружена');
} catch (error) {
    console.log(`⚠️ Не удалось загрузить аккумуляционную модель: ${error.message}`);
    // Фоллбэк класс
    AccumulativeModel = class {
        constructor(options = {}) {
            this.id = `accum_${Date.now()}`;
            this.geometricPassports = new Map();
            this.footprints = new Map();
            this.confirmationStats = {
                totalPassports: 0,
                byConfirmations: { '1': 0, '2': 0, '3+': 0 }
            };
        }
    };
}

// 🔥 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ
let GeometricHashAlgorithm;
try {
    GeometricHashAlgorithm = require('./clean/vector-algorithm');
    console.log('✅ Геометрический алгоритм загружен');
} catch (error) {
    console.log(`⚠️ Не удалось загрузить геометрический алгоритм: ${error.message}`);
}

// 🔥 ОСНОВНОЙ КЛАСС МЕНЕДЖЕРА
class SimpleFootprintManager {
    constructor(options = {}) {
        console.log('🚀 SimpleFootprintManager создан с АККУМУЛЯЦИОННОЙ МОДЕЛЬЮ');

        // 🔥 НАСТРОЙКИ
        const {
            dbPath = './data/footprints',
            autoSave = true,
            debug = false,
            enableAccumulativeModel = true,
            enableVisualization = true,
            similarityThreshold = 0.6,
            minPointsForPhoto = 5,
            ...otherOptions
        } = options;

        this.config = {
            dbPath,
            autoSave,
            debug,
            enableAccumulativeModel,
            enableVisualization,
            similarityThreshold,
            minPointsForPhoto,
            ...otherOptions
        };

        // 🔥 АККУМУЛЯТОРЫ ДЛЯ КАЖДОГО ПОЛЬЗОВАТЕЛЯ
        this.accumulativeModels = new Map(); // userId -> AccumulativeModel

        // 🔥 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ
        if (GeometricHashAlgorithm) {
            this.geometricAlgorithm = new GeometricHashAlgorithm({
                minSimilarity: this.config.similarityThreshold,
                debug: this.config.debug
            });
        }

        // 🔥 СЕССИИ (для совместимости)
        this.sessions = new Map();

        // 🔥 ВИЗУАЛИЗАЦИЯ
        if (this.config.enableVisualization) {
            try {
                const ClusterVisualizer = require('./visualizations/cluster-visualizer');
                this.visualizer = new ClusterVisualizer({
                    outputDir: path.join(this.config.dbPath, 'visualizations', 'accumulative'),
                    debug: this.config.debug
                });
                console.log('✅ Визуализатор загружен');
            } catch (error) {
                console.log(`⚠️ Визуализатор не доступен: ${error.message}`);
                this.visualizer = null;
            }
        }

        // Статистика системы
        this.systemStats = {
            totalUsers: 0,
            totalPhotos: 0,
            totalAccumulators: 0,
            algorithm: 'geometric_hash_accumulative_v1.0',
            createdAt: new Date()
        };

        this.ensureDirectories();
        console.log('✅ SimpleFootprintManager с аккумуляционной моделью инициализирован');
    }

    // 🔥 ИЗМЕНЕННЫЙ МЕТОД: ОБРАБОТКА СОВПАВШИХ СЛЕДОВ
    async processMatchingFootprint(session, userId, tempFootprint, finalGraph, transformationInfo,
                                  existingTransformationInfo, similarity, comparisonResult,
                                  tempResult, bot, chatId) {
        console.log(`✅ Следы совпали (${similarity.toFixed(3)})`);

        try {
            // 1. Создаем или получаем аккумуляционную модель
            let accumModel = this.accumulativeModels.get(userId);
            if (!accumModel) {
                accumModel = new AccumulativeModel();
                this.accumulativeModels.set(userId, accumModel);
                this.systemStats.totalAccumulators++;

                // 🔥 ДОБАВЛЯЕМ ПЕРВЫЙ СЛЕД В МОДЕЛЬ (если есть)
                if (session.currentFootprint) {
                    const vectorFootprint1 = this.createGeometricFootprint(
                        this.extractVectorPoints(session.currentFootprint),
                        'first'
                    );
                    if (vectorFootprint1 && vectorFootprint1.length > 0) {
                        accumModel.addFootprint(vectorFootprint1, session.currentFootprint.id);
                        console.log(`✅ Первый след добавлен в аккумулятор: ${vectorFootprint1.length} точек`);
                    }
                }
            }

            // 2. 🔥 ДОБАВЛЯЕМ ТЕКУЩИЙ СЛЕД В АККУМУЛЯЦИОННУЮ МОДЕЛЬ
            const vectorFootprint2 = this.createGeometricFootprint(
                this.extractVectorPoints(tempFootprint),
                'current'
            );

            if (vectorFootprint2 && vectorFootprint2.length > 0) {
                accumModel.addFootprint(vectorFootprint2, tempFootprint.id);
                console.log(`✅ Текущий след добавлен в аккумулятор: ${vectorFootprint2.length} точек`);
            }

            // 3. 🔥 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ В POINT TRACKER (для совместимости)
            if (comparisonResult && comparisonResult.matches && comparisonResult.matches.length > 0) {
                const tracker = session.currentFootprint?.pointTracker;
                if (tracker && tracker.updateConfirmationsFromGeometricMatches) {
                    tracker.updateConfirmationsFromGeometricMatches(
                        comparisonResult.matches,
                        { photoId: `geo_${Date.now()}`, similarity: similarity }
                    );
                }
            }

            // 4. 🔥 СОЗДАЕМ ВИЗУАЛИЗАЦИЮ ИЗ АККУМУЛЯЦИОННОЙ МОДЕЛИ
            const vizData = accumModel.getVisualizationData();

            console.log(`📊 АККУМУЛЯЦИОННАЯ СТАТИСТИКА:`);
            console.log(`   Всего уникальных геометрических паспортов: ${vizData.stats.totalPassports}`);
            console.log(`   🔴 3+ подтверждений: ${vizData.stats.byConfirmations['3+']}`);
            console.log(`   🟠 2 подтверждения: ${vizData.stats.byConfirmations['2']}`);
            console.log(`   🔵 1 подтверждение: ${vizData.stats.byConfirmations['1']}`);

            // 5. СОЗДАЕМ ВИЗУАЛИЗАЦИЮ
            let vizPath = null;
            if (this.visualizer) {
                vizPath = await this.createAccumulativeVisualization(
                    vizData,
                    userId,
                    session.currentFootprint,
                    comparisonResult
                );
            }

            // 6. ОТПРАВКА В TELEGRAM
            let telegramResponse = null;
            if (bot && chatId && vizPath) {
                telegramResponse = await this.sendAccumulativeResultsToTelegram(
                    accumModel,
                    vizData,
                    similarity,
                    comparisonResult,
                    bot,
                    chatId
                );
            }

            // 7. СОХРАНЕНИЕ АККУМУЛЯТОРНОЙ МОДЕЛИ
            if (this.config.autoSave) {
                await this.saveAccumulativeModel(userId);
            }

            // 8. ФОРМИРУЕМ РЕЗУЛЬТАТ
            const result = {
                success: true,
                similarity: similarity,
                decision: 'same',
                accumulativeStats: vizData.stats,
                vizPath: vizPath,
                message: `✅ След добавлен! Уникальных геометрических паспортов: ${vizData.stats.totalPassports}`,
                telegramSent: !!telegramResponse
            };

            return result;

        } catch (error) {
            console.error(`❌ Ошибка в processMatchingFootprint: ${error.message}`);
            return {
                success: false,
                error: error.message,
                decision: 'error'
            };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: СОЗДАНИЕ ГЕОМЕТРИЧЕСКОГО СЛЕДА
    createGeometricFootprint(points, source = 'unknown') {
        if (!this.geometricAlgorithm || !points || points.length === 0) {
            return null;
        }

        try {
            const footprint = this.geometricAlgorithm.createFootprint(points, source);
            return footprint || null;
        } catch (error) {
            console.log(`⚠️ Ошибка создания геометрического следа: ${error.message}`);
            return null;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: СОЗДАНИЕ ВИЗУАЛИЗАЦИИ АККУМУЛЯТОРА
    async createAccumulativeVisualization(vizData, userId, footprint = null, comparisonResult = null) {
        if (!this.visualizer || !vizData) {
            console.log('⚠️ Визуализатор не доступен или нет данных');
            return null;
        }

        try {
            const result = await this.visualizer.visualizeAccumulativeModel(
                vizData,
                footprint || { id: `fp_${userId}`, name: `Аккумулятор ${userId}` },
                {
                    comparisonResult: comparisonResult,
                    showStats: true,
                    showLegend: true,
                    filename: `accum_${userId}_${Date.now()}.png`
                }
            );

            console.log(`✅ Визуализация аккумулятора создана: ${result?.path || 'нет пути'}`);
            return result?.path || null;

        } catch (error) {
            console.log(`⚠️ Ошибка создания визуализации аккумулятора: ${error.message}`);
            return null;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: ОТПРАВКА РЕЗУЛЬТАТОВ В TELEGRAM
    async sendAccumulativeResultsToTelegram(accumModel, vizData, similarity, comparisonResult, bot, chatId) {
        try {
            if (!bot || !chatId || !vizData.stats) {
                return null;
            }

            const stats = vizData.stats;

            let caption = `🎯 АККУМУЛЯЦИОННАЯ МОДЕЛЬ\n\n`;
            caption += `📊 Всего уникальных геометрических паспортов: ${stats.totalPassports}\n`;
            caption += `🔴 3+ подтверждений: ${stats.byConfirmations['3+'] || 0}\n`;
            caption += `🟠 2 подтверждения: ${stats.byConfirmations['2'] || 0}\n`;
            caption += `🔵 1 подтверждение: ${stats.byConfirmations['1'] || 0}\n\n`;

            caption += `🎯 Геометрическое сходство: ${(similarity * 100).toFixed(1)}%\n`;
            caption += `🤔 Решение: ${comparisonResult?.decision === 'same' ? 'ОДНА обувь ✅' : 'Разная обувь'}\n\n`;

            caption += `💾 Аккумулятор: ${accumModel.id.slice(0, 8)}`;
            caption += `\n📈 Метод: Геометрические паспорта (инвариантные)`;

            // Очистка Markdown
            const cleanMarkdown = (text) => text
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/__/g, '')
                .replace(/_/g, '')
                .replace(/`/g, '');

            // Если есть путь к визуализации - отправляем фото
            if (vizData._vizPath && fs.existsSync(vizData._vizPath)) {
                await bot.sendPhoto(chatId, vizData._vizPath, {
                    caption: cleanMarkdown(caption),
                    parse_mode: 'HTML'
                });
                console.log('✅ Результаты аккумулятора отправлены в Telegram');
                return { success: true, caption: caption };
            } else {
                // Иначе отправляем только текст
                await bot.sendMessage(chatId, cleanMarkdown(caption), {
                    parse_mode: 'HTML'
                });
                return { success: true, textOnly: true };
            }

        } catch (error) {
            console.log(`❌ Ошибка отправки в Telegram: ${error.message}`);
            return null;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: СОХРАНЕНИЕ АККУМУЛЯТОРНОЙ МОДЕЛИ
    async saveAccumulativeModel(userId) {
        try {
            const accumModel = this.accumulativeModels.get(userId);
            if (!accumModel) {
                console.log(`⚠️ Нет аккумуляционной модели для сохранения: ${userId}`);
                return false;
            }

            const accumulatorsDir = path.join(this.config.dbPath, 'accumulative_models');
            if (!fs.existsSync(accumulatorsDir)) {
                fs.mkdirSync(accumulatorsDir, { recursive: true });
            }

            const data = {
                id: accumModel.id,
                userId: userId,
                geometricPassports: Array.from(accumModel.geometricPassports.entries()),
                footprints: Array.from(accumModel.footprints.entries()),
                confirmationStats: accumModel.confirmationStats,
                _version: '1.0-geometric-passports',
                _savedAt: new Date().toISOString()
            };

            const filename = `accum_model_${userId}_${Date.now()}.json`;
            const filePath = path.join(accumulatorsDir, filename);

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

            console.log(`💾 Аккумуляционная модель сохранена: ${filePath}`);
            return { success: true, filePath };

        } catch (error) {
            console.log(`⚠️ Ошибка сохранения аккумуляционной модели: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: ЗАГРУЗКА АККУМУЛЯТОРНОЙ МОДЕЛИ
    async loadAccumulativeModel(userId) {
        try {
            const accumulatorsDir = path.join(this.config.dbPath, 'accumulative_models');
            if (!fs.existsSync(accumulatorsDir)) {
                console.log(`📂 Нет директории аккумуляционных моделей`);
                return false;
            }

            const files = fs.readdirSync(accumulatorsDir)
                .filter(f => f.includes(userId.toString()) && f.endsWith('.json'))
                .sort()
                .reverse();

            if (files.length === 0) {
                console.log(`📂 Нет сохраненных аккумуляционных моделей для ${userId}`);
                return false;
            }

            const latestFile = files[0];
            const filePath = path.join(accumulatorsDir, latestFile);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            // Создаем аккумуляционную модель
            const accumModel = new AccumulativeModel();
            accumModel.id = data.id || accumModel.id;

            // Восстанавливаем геометрические паспорты
            if (Array.isArray(data.geometricPassports)) {
                for (const [hash, passportData] of data.geometricPassports) {
                    accumModel.geometricPassports.set(hash, passportData);
                }
            }

            // Восстанавливаем следы
            if (Array.isArray(data.footprints)) {
                for (const [footprintId, hashSet] of data.footprints) {
                    accumModel.footprints.set(footprintId, new Set(hashSet));
                }
            }

            // Восстанавливаем статистику
            if (data.confirmationStats) {
                accumModel.confirmationStats = data.confirmationStats;
            }

            // Обновляем статистику
            accumModel.updateStats();

            // Сохраняем в менеджере
            this.accumulativeModels.set(userId, accumModel);

            console.log(`📂 Загружена аккумуляционная модель для ${userId}: ${accumModel.geometricPassports.size} геометрических паспортов`);
            return accumModel;

        } catch (error) {
            console.log(`⚠️ Ошибка загрузки аккумуляционной модели: ${error.message}`);
            return false;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: ДОБАВЛЕНИЕ ФОТО С ГЕОМЕТРИЧЕСКИМИ ПАСПОРТАМИ
    async addPhotoWithGeometricPassports(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО С ГЕОМЕТРИЧЕСКИМИ ПАСПОРТАМИ для ${userId}`);

        try {
            // 1. Извлекаем точки из анализа
            const points = this.extractPointsFromAnalysis(analysis);

            if (points.length < this.config.minPointsForPhoto) {
                console.log(`⚠️ Слишком мало точек: ${points.length}`);
                return {
                    success: false,
                    error: `Слишком мало точек: ${points.length}`,
                    nodesAdded: 0
                };
            }

            console.log(`📊 Извлечено ${points.length} точек из анализа`);

            // 2. Создаем геометрический след
            const geometricFootprint = this.createGeometricFootprint(points, `photo_${Date.now()}`);
            if (!geometricFootprint || geometricFootprint.length === 0) {
                console.log(`⚠️ Не удалось создать геометрический след`);
                return {
                    success: false,
                    error: 'Не удалось создать геометрический след',
                    nodesAdded: 0
                };
            }

            // 3. Получаем или создаем аккумуляционную модель
            let accumModel = this.accumulativeModels.get(userId);
            if (!accumModel) {
                accumModel = new AccumulativeModel();
                this.accumulativeModels.set(userId, accumModel);
                this.systemStats.totalAccumulators++;
                console.log(`✅ Создана новая аккумуляционная модель для ${userId}`);
            }

            // 4. Добавляем геометрический след в аккумулятор
            const footprintId = `footprint_${Date.now()}`;
            accumModel.addFootprint(geometricFootprint, footprintId);

            // 5. СРАВНЕНИЕ С СУЩЕСТВУЮЩИМИ ПАСПОРТАМИ (если уже есть данные)
            let comparisonResult = null;
            if (accumModel.geometricPassports.size > geometricFootprint.length) {
                comparisonResult = await this.compareWithExistingPassports(
                    geometricFootprint,
                    accumModel,
                    points
                );
            }

            // 6. ВИЗУАЛИЗАЦИЯ
            const vizData = accumModel.getVisualizationData();
            let visualizationResult = null;
            if (this.visualizer) {
                visualizationResult = await this.createAccumulativeVisualization(
                    vizData,
                    userId,
                    null,
                    comparisonResult
                );
                vizData._vizPath = visualizationResult;
            }

            // 7. ОТПРАВКА В TELEGRAM
            let telegramResponse = null;
            if (bot && chatId && visualizationResult) {
                telegramResponse = await this.sendAccumulativeResultsToTelegram(
                    accumModel,
                    { ...vizData, _vizPath: visualizationResult },
                    comparisonResult?.similarity || 0,
                    comparisonResult,
                    bot,
                    chatId
                );
            }

            // 8. СОХРАНЕНИЕ
            if (this.config.autoSave) {
                await this.saveAccumulativeModel(userId);
            }

            // 9. ФОРМИРУЕМ ОТВЕТ
            const result = {
                success: true,
                userId: userId,
                accumulativeModelId: accumModel.id,
                geometricPassportsAdded: geometricFootprint.length,
                totalPassports: accumModel.geometricPassports.size,
                stats: accumModel.confirmationStats,
                comparison: comparisonResult,
                visualization: visualizationResult,
                telegramSent: !!telegramResponse,
                method: 'geometric_passports'
            };

            console.log(`✅ Фото добавлено с геометрическими паспортами:`);
            console.log(`   Всего геометрических паспортов: ${accumModel.confirmationStats.totalPassports}`);
            console.log(`   🔴 3+ подтверждений: ${accumModel.confirmationStats.byConfirmations['3+']}`);
            console.log(`   🟠 2 подтверждения: ${accumModel.confirmationStats.byConfirmations['2']}`);
            console.log(`   🔵 1 подтверждение: ${accumModel.confirmationStats.byConfirmations['1']}`);

            if (comparisonResult) {
                console.log(`   🎯 Геометрическое сходство: ${(comparisonResult.similarity * 100).toFixed(1)}%`);
            }

            return result;

        } catch (error) {
            console.error(`❌ Ошибка в addPhotoWithGeometricPassports: ${error.message}`);
            return {
                success: false,
                error: error.message,
                nodesAdded: 0
            };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: СРАВНЕНИЕ С СУЩЕСТВУЮЩИМИ ПАСПОРТАМИ
    async compareWithExistingPassports(newGeometricFootprint, accumModel, originalPoints) {
        if (!this.geometricAlgorithm || !newGeometricFootprint || newGeometricFootprint.length === 0) {
            return null;
        }

        try {
            // Собираем существующие паспорта в формат для сравнения
            const existingPassports = [];
            for (const [hash, passport] of accumModel.geometricPassports) {
                if (passport.examplePoint) {
                    existingPassports.push({
                        ...passport.examplePoint,
                        geometricHash: hash,
                        confirmations: passport.confirmations || 1
                    });
                }
            }

            if (existingPassports.length === 0) {
                return null;
            }

            console.log(`🔍 Сравниваю ${newGeometricFootprint.length} новых с ${existingPassports.length} существующими паспортами`);

            // Используем геометрический алгоритм для сравнения
            const result = this.geometricAlgorithm.comparePoints(
                newGeometricFootprint,
                existingPassports,
                'Новое фото',
                'Аккумулятор паспортов'
            );

            return {
                similarity: result.similarity || 0,
                decision: result.decision || 'unknown',
                matches: result.matches || [],
                stats: result.stats || {},
                method: 'geometric_passport_comparison'
            };

        } catch (error) {
            console.log(`⚠️ Ошибка сравнения паспортов: ${error.message}`);
            return null;
        }
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (без изменений)
    extractVectorPoints(footprint) {
        if (!footprint) return [];

        const points = [];

        // Извлекаем точки из pointTracker
        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({
                    id: id,
                    x: point.x,
                    y: point.y,
                    confidence: point.confidence || point.rating || 0.5,
                    confirmedCount: point.confirmedCount || 1,
                    source: 'point_tracker'
                });
            }
        }

        // Извлекаем точки напрямую
        if (footprint.points && Array.isArray(footprint.points)) {
            footprint.points.forEach((point, index) => {
                points.push({
                    id: point.id || `pt_${index}`,
                    x: point.x,
                    y: point.y,
                    confidence: point.confidence || 0.5,
                    source: 'direct'
                });
            });
        }

        return points;
    }

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
                    class: pred.class,
                    _source: 'analysis',
                    _timestamp: new Date()
                });
            }
        }

        return points.filter(p =>
            p && typeof p.x === 'number' && typeof p.y === 'number' &&
            !isNaN(p.x) && !isNaN(p.y)
        );
    }

    // 🔥 ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        // Используем новый метод с геометрическими паспортами
        return this.addPhotoWithGeometricPassports(userId, analysis, photoInfo, bot, chatId);
    }

    getActiveSession(userId) {
        return this.sessions.get(userId) || null;
    }

    createSession(userId, name = null) {
        const session = {
            id: `session_${Date.now()}`,
            userId: userId,
            name: name || `Сессия_${new Date().toLocaleTimeString('ru-RU')}`,
            createdAt: new Date(),
            lastActivity: new Date(),
            photos: []
        };

        this.sessions.set(userId, session);
        return session;
    }

    // 🔥 МЕТОДЫ ДЛЯ РАБОТЫ С АККУМУЛЯТОРАМИ
    getAccumulativeModelInfo(userId) {
        const accumModel = this.accumulativeModels.get(userId);
        if (!accumModel) {
            return { exists: false, message: 'Аккумуляционная модель не найдена' };
        }

        const stats = accumModel.confirmationStats;

        return {
            exists: true,
            id: accumModel.id,
            userId: userId,
            totalPassports: stats.totalPassports,
            confirmations: stats.byConfirmations,
            footprintsCount: accumModel.footprints.size,
            canVisualize: true
        };
    }

    getSystemStats() {
        return {
            ...this.systemStats,
            activeAccumulativeModels: this.accumulativeModels.size,
            algorithm: 'Геометрические паспорта v1.0'
        };
    }

    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'accumulative_models'),
            path.join(this.config.dbPath, 'visualizations', 'accumulative'),
            path.join(this.config.dbPath, 'reports')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                console.log(`📁 Создаю директорию: ${dir}`);
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
}

module.exports = SimpleFootprintManager;
