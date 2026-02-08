// modules/footprint/simple-manager.js
// 🔥 УПРОЩЕННЫЙ МЕНЕДЖЕР С АККУМУЛЯТОРОМ

const fs = require('fs');
const path = require('path');

// 🔥 ЗАГРУЖАЕМ АККУМУЛЯТОР
let GeometricAccumulator;
try {
    GeometricAccumulator = require('./accumulator');
    console.log('✅ GeometricAccumulator загружен');
} catch (error) {
    console.log(`⚠️ Не удалось загрузить GeometricAccumulator: ${error.message}`);
    GeometricAccumulator = null;
}

// 🔥 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ
let GeometricHashAlgorithm;
try {
    GeometricHashAlgorithm = require('./clean/vector-algorithm');
    console.log('✅ Геометрический алгоритм загружен');
} catch (error) {
    console.log(`⚠️ Не удалось загрузить геометрический алгоритм: ${error.message}`);
}

class SimpleFootprintManager {
    constructor(options = {}) {
        console.log('🚀 SimpleFootprintManager создан с ПРОСТЫМ АККУМУЛЯТОРОМ');
       
        // 🔥 ПРОСТЫЕ НАСТРОЙКИ
        const {
            dbPath = './data/footprints',
            debug = false,
            enableAccumulator = true,
            enableVisualization = true,
            similarityThreshold = 0.6,
            minPointsForPhoto = 5,
            ...otherOptions
        } = options;
       
        this.config = {
            dbPath,
            debug,
            enableAccumulator,
            enableVisualization,
            similarityThreshold,
            minPointsForPhoto,
            ...otherOptions
        };
       
        // 🔥 АККУМУЛЯТОРЫ ДЛЯ КАЖДОГО ПОЛЬЗОВАТЕЛЯ
        this.accumulators = new Map(); // userId -> GeometricAccumulator
       
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
       
        // Статистика
        this.systemStats = {
            totalUsers: 0,
            totalPhotos: 0,
            totalAccumulators: 0,
            algorithm: 'simple_geometric_accumulator_v1.0',
            createdAt: new Date()
        };
       
        this.ensureDirectories();
        console.log('✅ SimpleFootprintManager с простым аккумулятором инициализирован');
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: ОБРАБОТКА СОВПАВШИХ СЛЕДОВ
    async processMatchingFootprint(session, userId, tempFootprint, finalGraph, transformationInfo,
                                  existingTransformationInfo, similarity, comparisonResult,
                                  tempResult, bot, chatId) {
        console.log(`✅ Следы совпали (${similarity.toFixed(3)})`);
       
        try {
            // 1. Получаем или создаем аккумулятор
            let accumulator = this.accumulators.get(userId);
            if (!accumulator && GeometricAccumulator) {
                accumulator = new GeometricAccumulator(userId, {
                    debug: this.config.debug
                });
                this.accumulators.set(userId, accumulator);
                this.systemStats.totalAccumulators++;
               
                // 🔥 ДОБАВЛЯЕМ ПЕРВЫЙ СЛЕД В АККУМУЛЯТОР
                const points1 = this.extractVectorPoints(session.currentFootprint);
                if (GeometricHashAlgorithm) {
                    const vecAlgo = new GeometricHashAlgorithm();
                    accumulator.addFootprintViaVectorAlgorithm(points1, session.currentFootprint.id, vecAlgo);
                } else {
                    // Простое добавление
                    accumulator.addPointsDirectly(points1, session.currentFootprint.id);
                }
               
                console.log(`✅ Создан аккумулятор для ${userId}`);
            }
           
            if (!accumulator) {
                console.log(`❌ Невозможно создать аккумулятор`);
                return {
                    success: false,
                    error: 'Аккумулятор не доступен',
                    decision: 'error'
                };
            }
           
            // 2. 🔥 ДОБАВЛЯЕМ ТЕКУЩИЙ СЛЕД В АККУМУЛЯТОР
            const points2 = this.extractVectorPoints(tempFootprint);
            let addResult;
           
            if (GeometricHashAlgorithm) {
                const vecAlgo = new GeometricHashAlgorithm();
                addResult = accumulator.addFootprintViaVectorAlgorithm(
                    points2,
                    tempFootprint.id,
                    vecAlgo
                );
            } else {
                // Простое добавление
                addResult = {
                    newPoints: accumulator.addPointsDirectly(points2, tempFootprint.id),
                    totalPoints: accumulator.geometricPoints.size,
                    stats: accumulator.getStats()
                };
            }
           
            // 3. 🔥 ПОЛУЧАЕМ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
            const vizData = accumulator.getVisualizationData();
           
            console.log(`\n📊 АККУМУЛЯЦИОННАЯ СТАТИСТИКА:`);
            console.log(`   Всего уникальных геометрических точек: ${vizData.stats.totalUniquePoints}`);
            console.log(`   🔴 3+ подтверждений: ${vizData.stats.byConfirmations['3+']}`);
            console.log(`   🟠 2 подтверждения: ${vizData.stats.byConfirmations['2']}`);
            console.log(`   🔵 1 подтверждение: ${vizData.stats.byConfirmations['1']}`);
            console.log(`   📈 Всего следов: ${vizData.totalFootprints}`);
           
            // 4. СОЗДАЕМ ВИЗУАЛИЗАЦИЮ
            let vizPath = null;
            if (this.visualizer) {
                const vizResult = await this.visualizer.visualizeSimpleAccumulator(
                    vizData,
                    session.currentFootprint,
                    userId
                );
                vizPath = vizResult?.path;
            }
           
            // 5. ОТПРАВКА В TELEGRAM
            let telegramResponse = null;
            if (bot && chatId && vizPath) {
                telegramResponse = await this.sendAccumulatorResultsToTelegram(
                    accumulator,
                    vizData,
                    similarity,
                    bot,
                    chatId
                );
            }
           
            // 6. СОХРАНЕНИЕ
            if (this.config.dbPath) {
                await this.saveAccumulator(userId);
            }
           
            // 7. ФОРМИРУЕМ РЕЗУЛЬТАТ
            const result = {
                success: true,
                similarity: similarity,
                decision: 'same',
                accumulatorStats: vizData.stats,
                vizPath: vizPath,
                message: `✅ След добавлен в аккумулятор! Уникальных точек: ${vizData.stats.totalUniquePoints}`,
                algorithm: 'simple_geometric_accumulation',
                telegramSent: !!telegramResponse,
                totalPoints: vizData.stats.totalUniquePoints,
                newPoints: addResult.newPoints
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
   
    // 🔥 НОВЫЙ МЕТОД: ДОБАВЛЕНИЕ ФОТО В АККУМУЛЯТОР
    async addPhotoToAccumulator(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО В АККУМУЛЯТОР для ${userId}`);
       
        try {
            // 1. Извлекаем точки из анализа
            const points = this.extractPointsFromAnalysis(analysis);
           
            if (points.length < this.config.minPointsForPhoto) {
                console.log(`⚠️ Слишком мало точек: ${points.length}`);
                return {
                    success: false,
                    error: `Слишком мало точек: ${points.length}`,
                    pointsAdded: 0
                };
            }
           
            console.log(`📊 Извлечено ${points.length} точек из анализа`);
           
            // 2. Получаем или создаем аккумулятор
            let accumulator = this.accumulators.get(userId);
            if (!accumulator && GeometricAccumulator) {
                accumulator = new GeometricAccumulator(userId, {
                    debug: this.config.debug
                });
                this.accumulators.set(userId, accumulator);
                this.systemStats.totalAccumulators++;
                console.log(`✅ Создан новый аккумулятор для ${userId}`);
            }
           
            if (!accumulator) {
                console.log(`❌ Невозможно создать аккумулятор`);
                return {
                    success: false,
                    error: 'Аккумулятор не доступен',
                    pointsAdded: 0
                };
            }
           
            // 3. 🔥 СРАВНЕНИЕ С СУЩЕСТВУЮЩИМИ ТОЧКАМИ
            let comparisonResult = null;
            if (accumulator.geometricPoints.size > 0) {
                if (GeometricHashAlgorithm) {
                    const vecAlgo = new GeometricHashAlgorithm();
                    comparisonResult = accumulator.compareWithNewPoints(points, vecAlgo);
                } else {
                    comparisonResult = accumulator.compareWithNewPoints(points);
                }
               
                console.log(`🔍 Сравнение: ${comparisonResult.similarity.toFixed(3)} схожести`);
            }
           
            // 4. 🔥 ДОБАВЛЕНИЕ ТОЧЕК В АККУМУЛЯТОР
            const footprintId = `photo_${Date.now()}`;
            let addResult;
           
            if (GeometricHashAlgorithm) {
                const vecAlgo = new GeometricHashAlgorithm();
                addResult = accumulator.addFootprintViaVectorAlgorithm(
                    points,
                    footprintId,
                    vecAlgo
                );
            } else {
                // Простое добавление
                addResult = {
                    newPoints: accumulator.addPointsDirectly(points, footprintId),
                    totalPoints: accumulator.geometricPoints.size,
                    stats: accumulator.getStats()
                };
            }
           
            // 5. ВИЗУАЛИЗАЦИЯ
            const vizData = accumulator.getVisualizationData();
            let visualizationResult = null;
            if (this.visualizer) {
                visualizationResult = await this.visualizer.visualizeSimpleAccumulator(
                    vizData,
                    { id: footprintId, name: `Фото ${new Date().toLocaleTimeString('ru-RU')}` },
                    userId
                );
                vizData._vizPath = visualizationResult?.path;
            }
           
            // 6. ОТПРАВКА В TELEGRAM
            let telegramResponse = null;
            if (bot && chatId && visualizationResult?.path) {
                telegramResponse = await this.sendAccumulatorResultsToTelegram(
                    accumulator,
                    vizData,
                    comparisonResult?.similarity || 0,
                    bot,
                    chatId
                );
            }
           
            // 7. СОХРАНЕНИЕ
            if (this.config.dbPath) {
                await this.saveAccumulator(userId);
            }
           
            // 8. ОБНОВЛЕНИЕ СТАТИСТИКИ
            this.systemStats.totalPhotos++;
           
            // 9. ФОРМИРУЕМ ОТВЕТ
            const result = {
                success: true,
                userId: userId,
                accumulatorId: accumulator.id,
                pointsAdded: addResult.newPoints,
                totalPoints: accumulator.geometricPoints.size,
                stats: accumulator.getStats(),
                comparison: comparisonResult,
                visualization: visualizationResult?.path,
                telegramSent: !!telegramResponse,
                algorithm: 'simple_accumulator'
            };
           
            console.log(`✅ Фото добавлено в аккумулятор:`);
            console.log(`   Всего точек: ${accumulator.geometricPoints.size}`);
            console.log(`   🔴 3+ подтверждений: ${accumulator.stats.byConfirmations['3+']}`);
            console.log(`   🟠 2 подтверждения: ${accumulator.stats.byConfirmations['2']}`);
            console.log(`   🔵 1 подтверждение: ${accumulator.stats.byConfirmations['1']}`);
           
            if (comparisonResult) {
                console.log(`   🎯 Схожесть: ${(comparisonResult.similarity * 100).toFixed(1)}%`);
            }
           
            return result;
           
        } catch (error) {
            console.error(`❌ Ошибка в addPhotoToAccumulator: ${error.message}`);
            return {
                success: false,
                error: error.message,
                pointsAdded: 0
            };
        }
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Отправка результатов в Telegram
    async sendAccumulatorResultsToTelegram(accumulator, vizData, similarity, bot, chatId) {
        try {
            const stats = vizData.stats;
           
            let caption = `🎯 АККУМУЛЯТОР ГЕОМЕТРИЧЕСКИХ ТОЧЕК\n\n`;
            caption += `📊 Всего уникальных точек: ${stats.totalUniquePoints}\n`;
            caption += `🔴 3+ подтверждений: ${stats.byConfirmations['3+'] || 0}\n`;
            caption += `🟠 2 подтверждения: ${stats.byConfirmations['2'] || 0}\n`;
            caption += `🔵 1 подтверждение: ${stats.byConfirmations['1'] || 0}\n`;
            caption += `📈 Всего следов: ${vizData.totalFootprints || 1}\n\n`;
           
            if (similarity > 0) {
                caption += `🎯 Схожесть с предыдущими: ${(similarity * 100).toFixed(1)}%\n`;
            }
           
            caption += `⚡ Алгоритм: простая геометрическая аккумуляция`;
           
            // Очистка Markdown
            const cleanMarkdown = (text) => text
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/__/g, '')
                .replace(/_/g, '')
                .replace(/`/g, '');
           
            if (vizData._vizPath && fs.existsSync(vizData._vizPath)) {
                await bot.sendPhoto(chatId, vizData._vizPath, {
                    caption: cleanMarkdown(caption),
                    parse_mode: 'HTML'
                });
                console.log('✅ Результаты аккумулятора отправлены в Telegram');
                return { success: true, caption: caption };
            } else {
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
   
    // 🔥 СОХРАНЕНИЕ АККУМУЛЯТОРА
    async saveAccumulator(userId) {
        try {
            const accumulator = this.accumulators.get(userId);
            if (!accumulator) {
                console.log(`⚠️ Нет аккумулятора для сохранения: ${userId}`);
                return false;
            }
           
            const accumulatorsDir = path.join(this.config.dbPath, 'accumulators_simple');
            return accumulator.save(accumulatorsDir);
           
        } catch (error) {
            console.log(`⚠️ Ошибка сохранения аккумулятора: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
   
    // 🔥 ЗАГРУЗКА АККУМУЛЯТОРА
    async loadAccumulator(userId) {
        try {
            const accumulatorsDir = path.join(this.config.dbPath, 'accumulators_simple');
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
           
            const accumulator = GeometricAccumulator.load(filePath, userId);
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
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    extractVectorPoints(footprint) {
        if (!footprint) return [];
       
        const points = [];
       
        // Из pointTracker
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
       
        // Прямые точки
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
   
    // 🔥 ДЛЯ СОВМЕСТИМОСТИ
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        return this.addPhotoToAccumulator(userId, analysis, photoInfo, bot, chatId);
    }
   
    getAccumulatorInfo(userId) {
        const accumulator = this.accumulators.get(userId);
        if (!accumulator) {
            return { exists: false, message: 'Аккумулятор не найден' };
        }
       
        const stats = accumulator.getStats();
       
        return {
            exists: true,
            id: accumulator.id,
            userId: userId,
            totalPoints: accumulator.geometricPoints.size,
            stats: stats,
            footprintsCount: accumulator.footprintHashes.size,
            canVisualize: true
        };
    }
   
    getSystemStats() {
        return {
            ...this.systemStats,
            activeAccumulators: this.accumulators.size,
            algorithm: 'Простая геометрическая аккумуляция v1.0'
        };
    }
   
    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'accumulators_simple'),
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
   
    // 🔥 ТЕСТОВЫЙ МЕТОД
    generateTestData(userId, pointCount = 50) {
        const accumulator = new GeometricAccumulator(userId);
       
        // Тестовые точки
        for (let i = 0; i < 3; i++) {
            const points = [];
            for (let j = 0; j < pointCount; j++) {
                points.push({
                    x: 300 + Math.random() * 400 + (i * 20),
                    y: 200 + Math.random() * 300 + (i * 15),
                    confidence: 0.5 + Math.random() * 0.5
                });
            }
           
            accumulator.addPointsDirectly(points, `test_footprint_${i}`);
        }
       
        this.accumulators.set(userId, accumulator);
       
        console.log(`🧪 Создан тестовый аккумулятор: ${accumulator.geometricPoints.size} точек`);
        return accumulator;
    }
}

module.exports = SimpleFootprintManager;
