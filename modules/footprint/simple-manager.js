// modules/footprint/simple-manager.js
// 🔥 ИСПРАВЛЕННЫЙ - ИСПОЛЬЗУЕМ ВЕКТОРНЫЙ АЛГОРИТМ ДЛЯ ГЕОМЕТРИЧЕСКИХ ХЕШЕЙ

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

// 🔥 ВЕКТОРНЫЙ АЛГОРИТМ ДЛЯ СОЗДАНИЯ ИНВАРИАНТНЫХ ХЕШЕЙ
let VectorAlgorithm;
try {
    VectorAlgorithm = require('./clean/vector-algorithm');
    console.log('✅ VectorAlgorithm загружен для геометрических хешей');
} catch (error) {
    console.log(`⚠️ Не удалось загрузить векторный алгоритм: ${error.message}`);
    VectorAlgorithm = null;
}

// 🔥 ОСНОВНОЙ КЛАСС МЕНЕДЖЕРА
class SimpleFootprintManager {
    constructor(options = {}) {
        console.log('🚀 SimpleFootprintManager создан с ВЕКТОРНЫМИ ГЕОМЕТРИЧЕСКИМИ ХЕШАМИ');

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

        // 🔥 ВЕКТОРНЫЙ АЛГОРИТМ
        if (VectorAlgorithm) {
            this.vectorAlgorithm = new VectorAlgorithm({
                minSimilarity: this.config.similarityThreshold,
                debug: this.config.debug
            });
        } else {
            console.log('⚠️ ВНИМАНИЕ: Векторный алгоритм не загружен, будут использоваться простые хеши');
        }

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
            algorithm: 'vector_geometric_accumulator_v1.0',
            createdAt: new Date()
        };

        this.ensureDirectories();
        console.log('✅ SimpleFootprintManager с векторными геометрическими хешами инициализирован');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: ДОБАВЛЕНИЕ ФОТО ЧЕРЕЗ АККУМУЛЯТОР
    async addPhotoToAccumulator(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО В АККУМУЛЯТОР для ${userId}`);

        try {
            // 1. Извлекаем точки из анализа
            const rawPoints = this.extractRawPointsFromAnalysis(analysis);
            
            if (rawPoints.length < this.config.minPointsForPhoto) {
                console.log(`⚠️ Слишком мало точек: ${rawPoints.length}`);
                return {
                    success: false,
                    error: `Слишком мало точек: ${rawPoints.length}`,
                    minRequired: this.config.minPointsForPhoto
                };
            }

            console.log(`📊 Извлечено ${rawPoints.length} сырых точек из анализа`);

            // 2. 🔥 СОЗДАЕМ ИНВАРИАНТНЫЕ ГЕОМЕТРИЧЕСКИЕ ХЕШИ ЧЕРЕЗ ВЕКТОРНЫЙ АЛГОРИТМ
            const pointsWithVectorHashes = this.createVectorGeometricHashes(rawPoints, photoInfo.photoId || 'unknown');
            
            console.log(`🎯 Создано ${pointsWithVectorHashes.length} точек с векторными геометрическими хешами`);

            // 3. Получаем или создаем аккумулятор
            let accumulator = this.accumulators.get(userId);
            if (!accumulator) {
                accumulator = new GeometricAccumulator(userId);
                this.accumulators.set(userId, accumulator);
                this.systemStats.totalAccumulators++;
                console.log(`✅ Создан новый аккумулятор для ${userId}`);
            }

            // 4. 🔥 ДОБАВЛЯЕМ ТОЧКИ С ВЕКТОРНЫМИ ХЕШАМИ В АККУМУЛЯТОР
            const footprintId = photoInfo.photoId || `photo_${Date.now()}`;
            const addResult = accumulator.addFootprintWithGeometricHashes(pointsWithVectorHashes, footprintId);

            // 5. 🔥 ГЕОМЕТРИЧЕСКОЕ СРАВНЕНИЕ (если уже есть следы)
            let comparisonResult = null;
            let similarity = 0;
            
            if (accumulator.footprintHashes.size > 1) {
                const footprints = Array.from(accumulator.footprintHashes.keys());
                const lastFootprint = footprints[footprints.length - 2]; // Предыдущий след
                
                comparisonResult = accumulator.compareFootprints(lastFootprint, footprintId);
                similarity = comparisonResult.similarity || 0;
                console.log(`🎯 Векторное геометрическое сходство: ${(similarity * 100).toFixed(1)}%`);
            }

            // 6. 🔥 СОЗДАЕМ ВИЗУАЛИЗАЦИЮ АККУМУЛЯТОРА
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

            // 7. 🔥 ОТПРАВКА В TELEGRAM (если нужно)
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

            // 8. СОХРАНЕНИЕ АККУМУЛЯТОРА
            if (this.config.autoSave) {
                await this.saveAccumulator(userId);
            }

            // 9. ОБНОВЛЯЕМ СТАТИСТИКУ
            this.systemStats.totalPhotos++;
            if (this.systemStats.totalUsers === 0) {
                this.systemStats.totalUsers = this.accumulators.size;
            }

            // 10. ФОРМИРУЕМ ОТВЕТ
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
                method: 'vector_geometric_accumulator',
                message: `✅ Фото добавлено в аккумулятор. Уникальных точек: ${addResult.totalPoints}`,
                // 🔥 ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ:
                nodesAdded: addResult.newPoints,
                hasMergeVisualization: false,
                mergeMethod: 'vector_geometric_accumulation'
            };

            console.log(`\n📊 ВЕКТОРНЫЙ АККУМУЛЯТОР:`);
            console.log(`   Всего уникальных векторных точек: ${addResult.totalPoints}`);
            console.log(`   🔴 3+ подтверждений: ${addResult.stats.byConfirmations['3+'] || 0}`);
            console.log(`   🟠 2 подтверждения: ${addResult.stats.byConfirmations['2'] || 0}`);
            console.log(`   🔵 1 подтверждение: ${addResult.stats.byConfirmations['1'] || 0}`);
            console.log(`   📈 Всего следов: ${accumulator.footprintHashes.size}`);

            if (comparisonResult) {
                console.log(`   🎯 Векторное сходство: ${(comparisonResult.similarity * 100).toFixed(1)}%`);
                console.log(`   🤔 Решение: ${comparisonResult.decision === 'same' ? 'ОДНА обувь ✅' : 'Разная обувь'}`);
            }

            return result;

        } catch (error) {
            console.error(`❌ Ошибка в addPhotoToAccumulator: ${error.message}`);
            return {
                success: false,
                error: error.message,
                method: 'vector_geometric_accumulator'
            };
        }
    }

    // 🔥 МЕТОД: Извлечение сырых точек из анализа
    extractRawPointsFromAnalysis(analysis) {
        const points = [];
        const predictions = analysis.predictions || [];

        for (const pred of predictions) {
            if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);

                // Центральная точка стельки
                const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
                const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

                const point = {
                    x: centerX,
                    y: centerY,
                    confidence: pred.confidence || 0.5,
                    width: Math.max(...xs) - Math.min(...xs),
                    height: Math.max(...ys) - Math.min(...ys),
                    originalPoints: pred.points,
                    class: pred.class,
                    _source: 'analysis',
                    _timestamp: new Date()
                };

                points.push(point);
            }
        }

        // Фильтруем некорректные точки
        return points.filter(p =>
            p && typeof p.x === 'number' && typeof p.y === 'number' &&
            !isNaN(p.x) && !isNaN(p.y)
        );
    }

    // 🔥 МЕТОД: Создание векторных геометрических хешей
    createVectorGeometricHashes(rawPoints, sourceId) {
        if (!this.vectorAlgorithm || rawPoints.length === 0) {
            console.log('⚠️ Нет векторного алгоритма, использую простые хеши');
            return this.createSimpleGeometricHashes(rawPoints);
        }

        try {
            // 1. Создаем векторный отпечаток (инвариантный!)
            const vectorFootprint = this.vectorAlgorithm.createFootprint(rawPoints, sourceId);
            
            if (!vectorFootprint || vectorFootprint.length === 0) {
                console.log('⚠️ Не удалось создать векторный отпечаток');
                return this.createSimpleGeometricHashes(rawPoints);
            }

            console.log(`🎯 Создан векторный отпечаток: ${vectorFootprint.length} инвариантных точек`);

            // 2. Объединяем сырые точки с векторными хешами
            const pointsWithVectorHashes = [];
            
            vectorFootprint.forEach((vectorPoint, index) => {
                const rawPoint = rawPoints[index] || rawPoints[0];
                
                if (vectorPoint.vectorId || vectorPoint.geometricHash) {
                    pointsWithVectorHashes.push({
                        ...rawPoint,
                        geometricHash: vectorPoint.vectorId || vectorPoint.geometricHash,
                        vectorId: vectorPoint.vectorId,
                        vectorPoint: vectorPoint,
                        isVectorHash: true
                    });
                }
            });

            // Если не получилось создать векторные хеши, используем простые
            if (pointsWithVectorHashes.length === 0) {
                console.log('⚠️ Не удалось создать векторные хеши, использую простые');
                return this.createSimpleGeometricHashes(rawPoints);
            }

            return pointsWithVectorHashes;

        } catch (error) {
            console.log(`⚠️ Ошибка создания векторных хешей: ${error.message}`);
            return this.createSimpleGeometricHashes(rawPoints);
        }
    }

    // 🔥 МЕТОД: Создание простых геометрических хешей (фоллбэк)
    createSimpleGeometricHashes(points) {
        return points.map((point, index) => {
            // 🔥 ПРОСТОЙ ХЕШ НА ОСНОВЕ ОТНОСИТЕЛЬНЫХ КООРДИНАТ
            // Нормализуем координаты относительно центра облака точек
            
            const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
            const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
            
            // Относительные координаты (инвариантные к смещению)
            const relX = point.x - centerX;
            const relY = point.y - centerY;
            
            // Нормализованные координаты (инвариантные к масштабу)
            const distances = points.map(p => 
                Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2))
            );
            const maxDistance = Math.max(...distances, 1);
            
            const normX = relX / maxDistance;
            const normY = relY / maxDistance;
            
            // Округляем для группировки (4 знака после запятой)
            const gridX = Math.round(normX * 10000) / 10000;
            const gridY = Math.round(normY * 10000) / 10000;
            
            // Относительный размер (инвариантный к масштабу)
            const normWidth = point.width / maxDistance;
            const normHeight = point.height / maxDistance;
            
            // Создаем хеш на основе нормализованных данных
            const hashData = {
                x: gridX.toFixed(4),
                y: gridY.toFixed(4),
                w: normWidth.toFixed(4),
                h: normHeight.toFixed(4),
                c: point.confidence.toFixed(2)
            };
            
            const hashString = JSON.stringify(hashData);
            const geoHash = crypto.createHash('md5').update(hashString).digest('hex').substring(0, 16);
            
            return {
                ...point,
                geometricHash: `rel_${geoHash}`,
                isVectorHash: false,
                relativeX: relX,
                relativeY: relY,
                normalizedX: normX,
                normalizedY: normY
            };
        });
    }

    // 🔥 МЕТОД: Отправка результатов в Telegram
    async sendAccumulatorResultsToTelegram(accumulator, vizData, similarity, comparisonResult, addResult, bot, chatId, vizPath = null) {
        try {
            if (!bot || !chatId) {
                return null;
            }

            const stats = vizData.stats || accumulator.stats;

            let caption = `🎯 ВЕКТОРНЫЙ АККУМУЛЯТОР\n\n`;
            caption += `📊 Всего уникальных точек: ${stats.totalUniquePoints || 0}\n`;
            caption += `🔴 3+ подтверждений: ${stats.byConfirmations['3+'] || 0}\n`;
            caption += `🟠 2 подтверждения: ${stats.byConfirmations['2'] || 0}\n`;
            caption += `🔵 1 подтверждение: ${stats.byConfirmations['1'] || 0}\n`;
            caption += `📈 Всего следов: ${accumulator.footprintHashes.size}\n\n`;

            if (comparisonResult) {
                caption += `🎯 Векторное сходство: ${(similarity * 100).toFixed(1)}%\n`;
                caption += `🤔 Решение: ${comparisonResult.decision === 'same' ? 'ОДНА обувь ✅' : 'Разная обувь'}\n\n`;
            }

            caption += `📈 Добавлено: ${addResult.newPoints || 0} новых, ${addResult.existingPoints || 0} подтверждено\n`;
            caption += `💾 Аккумулятор: ${accumulator.id.slice(0, 8)}`;
            caption += `\n⚡ Метод: Векторная геометрическая аккумуляция`;

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
        
        // Используем новый метод с векторными хешами
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
            algorithm: 'Векторная геометрическая аккумуляция v1.0'
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
