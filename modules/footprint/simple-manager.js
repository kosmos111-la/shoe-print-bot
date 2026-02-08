// modules/footprint/simple-manager.js
// 🔥 ИСПРАВЛЕННЫЙ - СОЗДАЕМ ГЕОМЕТРИЧЕСКИЕ ХЕШИ ИЗ КООРДИНАТ

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 🔥 ИМПОРТ АККУМУЛЯТОРА
let GeometricAccumulator;
try {
    GeometricAccumulator = require('./accumulator');
    console.log('✅ GeometricAccumulator загружен');
} catch (error) {
    console.log(`⚠️ Не удалось загрузить GeometricAccumulator: ${error.message}`);
    // Фоллбэк класс
    GeometricAccumulator = class {
        constructor(userId) {
            this.userId = userId;
            this.id = `accum_${userId}_${Date.now()}`;
            this.geometricPoints = new Map();
            this.footprintHashes = new Map();
            this.pointExamples = new Map();
            this.stats = {
                totalUniquePoints: 0,
                byConfirmations: { '1': 0, '2': 0, '3+': 0 },
                totalFootprints: 0,
                createdAt: new Date()
            };
        }
    };
}

// 🔥 ОСНОВНОЙ КЛАСС МЕНЕДЖЕРА
class SimpleFootprintManager {
    constructor(options = {}) {
        console.log('🚀 SimpleFootprintManager создан с ГЕОМЕТРИЧЕСКИМ АККУМУЛЯТОРОМ');

        // 🔥 НАСТРОЙКИ
        const {
            dbPath = './data/footprints',
            autoSave = true,
            debug = false,
            enableAccumulator = true,
            enableVisualization = true,
            similarityThreshold = 0.6,
            minPointsForPhoto = 3,
            ...otherOptions
        } = options;

        this.config = {
            dbPath,
            autoSave,
            debug,
            enableAccumulator,
            enableVisualization,
            similarityThreshold,
            minPointsForPhoto,
            ...otherOptions
        };

        // 🔥 АККУМУЛЯТОРЫ ДЛЯ КАЖДОГО ПОЛЬЗОВАТЕЛЯ
        this.accumulators = new Map(); // userId -> GeometricAccumulator

        // 🔥 СЕССИИ (для совместимости)
        this.sessions = new Map();

        // 🔥 ВИЗУАЛИЗАЦИЯ
        if (this.config.enableVisualization) {
            try {
                const ClusterVisualizer = require('./visualizations/cluster-visualizer');
                this.visualizer = new ClusterVisualizer({
                    outputDir: path.join(this.config.dbPath, 'visualizations', 'accumulator'),
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
            algorithm: 'geometric_accumulator_v1.0',
            createdAt: new Date()
        };

        this.ensureDirectories();
        console.log('✅ SimpleFootprintManager с геометрическим аккумулятором инициализирован');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: ДОБАВЛЕНИЕ ФОТО ЧЕРЕЗ АККУМУЛЯТОР
    async addPhotoToAccumulator(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО В АККУМУЛЯТОР для ${userId}`);

        try {
            // 1. Извлекаем точки из анализа И СОЗДАЕМ ГЕОМЕТРИЧЕСКИЕ ХЕШИ
            const points = this.extractPointsWithGeometricHashes(analysis);

            if (points.length < this.config.minPointsForPhoto) {
                console.log(`⚠️ Слишком мало точек: ${points.length}`);
                return {
                    success: false,
                    error: `Слишком мало точек: ${points.length}`,
                    minRequired: this.config.minPointsForPhoto
                };
            }

            console.log(`📊 Извлечено ${points.length} точек с геометрическими хешами`);

            // 2. Получаем или создаем аккумулятор
            let accumulator = this.accumulators.get(userId);
            if (!accumulator) {
                accumulator = new GeometricAccumulator(userId);
                this.accumulators.set(userId, accumulator);
                this.systemStats.totalAccumulators++;
                console.log(`✅ Создан новый аккумулятор для ${userId}`);
            }

            // 3. 🔥 ДОБАВЛЯЕМ ТОЧКИ В АККУМУЛЯТОР
            const footprintId = photoInfo.photoId || `photo_${Date.now()}`;
            const addResult = accumulator.addFootprintWithGeometricHashes(points, footprintId);

            // 4. 🔥 ГЕОМЕТРИЧЕСКОЕ СРАВНЕНИЕ (если уже есть следы)
            let comparisonResult = null;
            let similarity = 0;
           
            if (accumulator.footprintHashes.size > 1) {
                const footprints = Array.from(accumulator.footprintHashes.keys());
                const lastFootprint = footprints[footprints.length - 2]; // Предыдущий след
               
                comparisonResult = accumulator.compareFootprints(lastFootprint, footprintId);
                similarity = comparisonResult.similarity || 0;
                console.log(`🎯 Сравнение с предыдущим следом: ${(similarity * 100).toFixed(1)}%`);
            }

            // 5. 🔥 СОЗДАЕМ ВИЗУАЛИЗАЦИЮ АККУМУЛЯТОРА
            const vizData = accumulator.getVisualizationData();
            let visualizationResult = null;
           
            if (this.visualizer) {
                visualizationResult = await this.visualizer.visualizeAccumulator(
                    vizData,
                    {
                        userId: userId,
                        comparisonResult: comparisonResult,
                        photoInfo: photoInfo,
                        showStats: true,
                        showLegend: true,
                        filename: `accum_${userId}_${Date.now()}.png`
                    }
                );
            }

            // 6. 🔥 ОТПРАВКА В TELEGRAM (если нужно)
            let telegramResponse = null;
            if (bot && chatId) {
                telegramResponse = await this.sendAccumulatorResultsToTelegram(
                    accumulator,
                    vizData,
                    similarity,
                    comparisonResult,
                    addResult,
                    bot,
                    chatId,
                    visualizationResult?.path
                );
            }

            // 7. СОХРАНЕНИЕ АККУМУЛЯТОРА
            if (this.config.autoSave) {
                await this.saveAccumulator(userId);
            }

            // 8. ОБНОВЛЯЕМ СТАТИСТИКУ
            this.systemStats.totalPhotos++;
            if (this.systemStats.totalUsers === 0) {
                this.systemStats.totalUsers = this.accumulators.size;
            }

            // 9. ФОРМИРУЕМ ОТВЕТ (для совместимости со старым кодом)
            const result = {
                success: true,
                userId: userId,
                accumulatorId: accumulator.id,
                pointsAdded: addResult.newPoints,
                pointsConfirmed: addResult.existingPoints,
                totalPoints: addResult.totalPoints,
                stats: addResult.stats,
                similarity: similarity,
                decision: comparisonResult?.decision || 'new_footprint',
                visualization: visualizationResult,
                telegramSent: !!telegramResponse,
                method: 'geometric_accumulator',
                message: `✅ Фото добавлено в аккумулятор. Уникальных точек: ${addResult.totalPoints}`,
                // 🔥 ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ:
                nodesAdded: addResult.newPoints,
                hasMergeVisualization: false,
                mergeMethod: 'geometric_accumulation'
            };

            console.log(`\n📊 АККУМУЛЯТОРНАЯ СТАТИСТИКА:`);
            console.log(`   Всего уникальных геометрических точек: ${addResult.totalPoints}`);
            console.log(`   🔴 3+ подтверждений: ${addResult.stats.byConfirmations['3+'] || 0}`);
            console.log(`   🟠 2 подтверждения: ${addResult.stats.byConfirmations['2'] || 0}`);
            console.log(`   🔵 1 подтверждение: ${addResult.stats.byConfirmations['1'] || 0}`);
            console.log(`   📈 Всего следов: ${accumulator.footprintHashes.size}`);

            if (comparisonResult) {
                console.log(`   🎯 Геометрическое сходство: ${(comparisonResult.similarity * 100).toFixed(1)}%`);
                console.log(`   🤔 Решение: ${comparisonResult.decision === 'same' ? 'ОДНА обувь ✅' : 'Разная обувь'}`);
            }

            return result;

        } catch (error) {
            console.error(`❌ Ошибка в addPhotoToAccumulator: ${error.message}`);
            return {
                success: false,
                error: error.message,
                method: 'geometric_accumulator'
            };
        }
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Извлечение точек с геометрическими хешами
    extractPointsWithGeometricHashes(analysis) {
        const points = [];
        const predictions = analysis.predictions || [];

        for (const pred of predictions) {
            if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);

                // Центральная точка стельки
                const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
                const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

                // 🔥 СОЗДАЕМ ГЕОМЕТРИЧЕСКИЙ ХЕШ НА ОСНОВЕ КООРДИНАТ
                // Используем округление до 5px для группировки близких точек
                const gridSize = 5;
                const gridX = Math.round(centerX / gridSize) * gridSize;
                const gridY = Math.round(centerY / gridSize) * gridSize;
               
                // Хеш на основе сетки и формы
                const width = Math.max(...xs) - Math.min(...xs);
                const height = Math.max(...ys) - Math.min(...ys);
                const aspectRatio = width / height;
               
                // Создаем уникальный хеш
                const geoHash = this.createGeometricHash({
                    gridX,
                    gridY,
                    width: Math.round(width / gridSize),
                    height: Math.round(height / gridSize),
                    aspectRatio: Math.round(aspectRatio * 100) / 100
                });

                const point = {
                    x: centerX,
                    y: centerY,
                    confidence: pred.confidence || 0.5,
                    geometricHash: geoHash,
                    originalPoints: pred.points,
                    class: pred.class,
                    width: width,
                    height: height,
                    aspectRatio: aspectRatio,
                    _source: 'analysis',
                    _timestamp: new Date()
                };

                points.push(point);
            }
        }

        // Фильтруем некорректные точки
        return points.filter(p =>
            p && typeof p.x === 'number' && typeof p.y === 'number' &&
            !isNaN(p.x) && !isNaN(p.y) &&
            p.geometricHash && p.geometricHash.length > 5
        );
    }

    // 🔥 МЕТОД: Создание геометрического хеша
    createGeometricHash(data) {
        try {
            // Создаем строку данных для хеширования
            const dataString = JSON.stringify({
                x: Math.round(data.gridX),
                y: Math.round(data.gridY),
                w: Math.round(data.width),
                h: Math.round(data.height),
                ar: Math.round(data.aspectRatio * 100)
            });
           
            // Создаем MD5 хеш
            const hash = crypto.createHash('md5').update(dataString).digest('hex');
            return `geo_${hash.substring(0, 16)}`;
        } catch (error) {
            // Фоллбэк: случайный хеш
            return `geo_fallback_${Math.random().toString(36).substring(2, 15)}`;
        }
    }

    // 🔥 МЕТОД: Отправка результатов в Telegram
    async sendAccumulatorResultsToTelegram(accumulator, vizData, similarity, comparisonResult, addResult, bot, chatId, vizPath = null) {
        try {
            if (!bot || !chatId) {
                return null;
            }

            const stats = vizData.stats || accumulator.stats;

            let caption = `🎯 АККУМУЛЯТОР ГЕОМЕТРИЧЕСКИХ ТОЧЕК\n\n`;
            caption += `📊 Всего уникальных точек: ${stats.totalUniquePoints || 0}\n`;
            caption += `🔴 3+ подтверждений: ${stats.byConfirmations['3+'] || 0}\n`;
            caption += `🟠 2 подтверждения: ${stats.byConfirmations['2'] || 0}\n`;
            caption += `🔵 1 подтверждение: ${stats.byConfirmations['1'] || 0}\n`;
            caption += `📈 Всего следов: ${accumulator.footprintHashes.size}\n\n`;

            if (comparisonResult) {
                caption += `🎯 Геометрическое сходство: ${(similarity * 100).toFixed(1)}%\n`;
                caption += `🤔 Решение: ${comparisonResult.decision === 'same' ? 'ОДНА обувь ✅' : 'Разная обувь'}\n\n`;
            }

            caption += `📈 Добавлено: ${addResult.newPoints || 0} новых, ${addResult.existingPoints || 0} подтверждено\n`;
            caption += `💾 Аккумулятор: ${accumulator.id.slice(0, 8)}`;
            caption += `\n⚡ Метод: Геометрическая аккумуляция`;

            // Очистка Markdown
            const cleanMarkdown = (text) => text
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/__/g, '')
                .replace(/_/g, '')
                .replace(/`/g, '');

            // Если есть путь к визуализации - отправляем фото
            if (vizPath && fs.existsSync(vizPath)) {
                await bot.sendPhoto(chatId, vizPath, {
                    caption: cleanMarkdown(caption),
                    parse_mode: 'HTML'
                });
                console.log('✅ Результаты аккумулятора отправлены в Telegram');
                return { success: true, caption: caption, hasPhoto: true };
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

    // 🔥 МЕТОД: Сохранение аккумулятора
    async saveAccumulator(userId) {
        try {
            const accumulator = this.accumulators.get(userId);
            if (!accumulator) {
                console.log(`⚠️ Нет аккумулятора для сохранения: ${userId}`);
                return false;
            }

            const accumulatorsDir = path.join(this.config.dbPath, 'accumulators');
            if (!fs.existsSync(accumulatorsDir)) {
                fs.mkdirSync(accumulatorsDir, { recursive: true });
            }

            const filename = `accumulator_${userId}_${Date.now()}.json`;
            const filePath = path.join(accumulatorsDir, filename);

            const saveResult = accumulator.saveToFile(filePath);
            return saveResult;

        } catch (error) {
            console.log(`⚠️ Ошибка сохранения аккумулятора: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // 🔥 МЕТОД: Загрузка аккумулятора
    async loadAccumulator(userId) {
        try {
            const accumulatorsDir = path.join(this.config.dbPath, 'accumulators');
            if (!fs.existsSync(accumulatorsDir)) {
                console.log(`📂 Нет директории аккумуляторов`);
                return false;
            }

            const files = fs.readdirSync(accumulatorsDir)
                .filter(f => f.includes(userId.toString()) && f.endsWith('.json'))
                .sort()
                .reverse();

            if (files.length === 0) {
                console.log(`📂 Нет сохраненных аккумуляторов для ${userId}`);
                return false;
            }

            const latestFile = files[0];
            const filePath = path.join(accumulatorsDir, latestFile);
           
            const accumulator = GeometricAccumulator.loadFromFile(filePath, userId);
           
            if (accumulator) {
                this.accumulators.set(userId, accumulator);
                console.log(`📂 Загружен аккумулятор для ${userId}: ${accumulator.geometricPoints.size} точек`);
                return accumulator;
            }

            return false;

        } catch (error) {
            console.log(`⚠️ Ошибка загрузки аккумулятора: ${error.message}`);
            return false;
        }
    }

    // 🔥 МЕТОД: Получить информацию об аккумуляторе
    getAccumulatorInfo(userId) {
        const accumulator = this.accumulators.get(userId);
        if (!accumulator) {
            return { exists: false, message: 'Аккумулятор не найден' };
        }

        return {
            exists: true,
            info: accumulator.getInfo(),
            canVisualize: true
        };
    }

    // 🔥 МЕТОД ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        // 🔥 ИСПРАВЛЕНИЕ: В логах видно, что вызывается addPhotoToSession
        // Этот метод должен вызвать addPhotoToAccumulator
        console.log(`👣 ВЫЗЫВАЮ SimpleFootprintManager.addPhotoToSession...`);
       
        // Извлекаем точки shoe-protector
        const protectorCount = analysis.predictions?.filter(p => p.class === 'shoe-protector').length || 0;
        console.log(`👣 Достаточно протекторов: ${protectorCount}`);
       
        if (protectorCount < this.config.minPointsForPhoto) {
            console.log(`⚠️ Недостаточно протекторов: ${protectorCount}`);
            return {
                success: false,
                error: `Недостаточно протекторов: ${protectorCount}`,
                nodesAdded: 0
            };
        }
       
        // Используем новый метод с аккумулятором
        return this.addPhotoToAccumulator(userId, analysis, photoInfo, bot, chatId);
    }

    // 🔥 МЕТОД: Обработка совпавших следов (для совместимости)
    async processMatchingFootprint(session, userId, tempFootprint, finalGraph, transformationInfo,
                                  existingTransformationInfo, similarity, comparisonResult,
                                  tempResult, bot, chatId) {
        console.log(`✅ Следы совпали (${similarity.toFixed(3)})`);
       
        // Создаем фиктивный анализ из следов
        const analysis = {
            predictions: this.extractPredictionsFromFootprint(tempFootprint)
        };
       
        const photoInfo = {
            photoId: tempFootprint.id || `match_${Date.now()}`,
            source: 'footprint_match',
            timestamp: new Date()
        };
       
        return this.addPhotoToAccumulator(userId, analysis, photoInfo, bot, chatId);
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

    extractPredictionsFromFootprint(footprint) {
        const predictions = [];
       
        if (footprint.points && Array.isArray(footprint.points)) {
            footprint.points.forEach((point, index) => {
                predictions.push({
                    class: 'shoe-protector',
                    confidence: point.confidence || 0.7,
                    points: [
                        { x: point.x - 10, y: point.y - 10 },
                        { x: point.x + 10, y: point.y - 10 },
                        { x: point.x + 10, y: point.y + 10 },
                        { x: point.x - 10, y: point.y + 10 }
                    ]
                });
            });
        }
       
        return predictions;
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

    // 🔥 Получение статистики системы
    getSystemStats() {
        return {
            ...this.systemStats,
            activeAccumulators: this.accumulators.size,
            algorithm: 'Геометрическая аккумуляция v1.0'
        };
    }

    // 🔥 Создание директорий
    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'accumulators'),
            path.join(this.config.dbPath, 'visualizations', 'accumulator'),
            path.join(this.config.dbPath, 'reports')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                console.log(`📁 Создаю директорию: ${dir}`);
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // 🔥 Тестовый метод: создание тестового аккумулятора
    createTestAccumulator(userId, pointCount = 50) {
        const accumulator = new GeometricAccumulator(userId);
       
        // Создаем тестовые точки с геометрическими хешами
        for (let i = 0; i < pointCount; i++) {
            const point = {
                x: Math.random() * 800 + 100,
                y: Math.random() * 600 + 100,
                confidence: 0.5 + Math.random() * 0.5,
                geometricHash: `test_geo_${i}_${crypto.randomBytes(4).toString('hex')}`
            };
           
            const points = [point];
            accumulator.addFootprintWithGeometricHashes(points, `test_photo_${i % 3 + 1}`);
        }
       
        this.accumulators.set(userId, accumulator);
        console.log(`🧪 Создан тестовый аккумулятор: ${accumulator.geometricPoints.size} точек`);
        return accumulator;
    }
}

module.exports = SimpleFootprintManager;
