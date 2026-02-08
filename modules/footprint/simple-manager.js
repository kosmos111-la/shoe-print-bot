// modules/footprint/simple-manager.js
// 🔥 АККУМУЛЯЦИОННАЯ МОДЕЛЬ - СОБИРАЕМ ВСЕ ТОЧКИ

const fs = require('fs');
const path = require('path');

// 🔥 КЛАСС АККУМУЛЯТОРА
class AccumulativeFootprint {
    constructor(userId) {
        this.userId = userId;
        this.id = `accum_${userId}_${Date.now()}`;
        this.name = `Аккумуляторный след ${userId}`;
       
        // 🔥 ХРАНИМ ВСЕ ТОЧКИ ИЗ ВСЕХ ФОТО
        this.allPoints = new Map(); // pointId -> {x, y, seenInPhotos: [], confirmedCount, confidence}
        this.photos = []; // История всех фото
       
        // Статистика
        this.stats = {
            totalPhotos: 0,
            totalPoints: 0,
            confirmed3: 0, // 3+ фото
            confirmed2: 0, // 2 фото
            confirmed1: 0, // 1 фото
            createdAt: new Date(),
            lastUpdated: new Date()
        };
       
        console.log(`🏗️ Создан AccumulativeFootprint для пользователя ${userId}`);
    }
   
    // 🔥 ГЕНЕРИРУЕМ ID ТОЧКИ НА ОСНОВЕ КООРДИНАТ
    getPointId(point) {
        // Округляем координаты для группировки близких точек
        const gridSize = 5; // 5px сетка
        const gridX = Math.round(point.x / gridSize) * gridSize;
        const gridY = Math.round(point.y / gridSize) * gridSize;
        return `pt_${gridX}_${gridY}`;
    }
   
    // 🔥 ДОБАВЛЯЕМ ФОТО С ТОЧКАМИ
    addPhoto(points, photoInfo = {}) {
        const photoId = photoInfo.photoId || `photo_${Date.now()}`;
        console.log(`📸 Добавляю фото ${photoId} с ${points.length} точками`);
       
        let newPoints = 0;
        let confirmedPoints = 0;
       
        points.forEach((point, index) => {
            const pointId = this.getPointId(point);
           
            if (!this.allPoints.has(pointId)) {
                // 🔥 НОВАЯ ТОЧКА
                this.allPoints.set(pointId, {
                    id: pointId,
                    x: point.x,
                    y: point.y,
                    originalX: point.x,
                    originalY: point.y,
                    confidence: point.confidence || 0.5,
                    seenInPhotos: [photoId],
                    confirmedCount: 1,
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                    sources: [photoInfo.source || 'unknown'],
                    isNew: true
                });
                newPoints++;
            } else {
                // 🔥 СУЩЕСТВУЮЩАЯ ТОЧКА - ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ
                const existing = this.allPoints.get(pointId);
               
                // Проверяем, не было ли уже этого фото
                if (!existing.seenInPhotos.includes(photoId)) {
                    existing.seenInPhotos.push(photoId);
                    existing.confirmedCount++;
                    existing.lastSeen = new Date();
                    existing.confidence = Math.min(1.0, existing.confidence + 0.1);
                   
                    if (photoInfo.source && !existing.sources.includes(photoInfo.source)) {
                        existing.sources.push(photoInfo.source);
                    }
                   
                    confirmedPoints++;
                }
            }
        });
       
        // Сохраняем информацию о фото
        this.photos.push({
            id: photoId,
            timestamp: new Date(),
            pointsCount: points.length,
            newPoints: newPoints,
            confirmedPoints: confirmedPoints,
            info: photoInfo
        });
       
        // Обновляем статистику
        this.stats.totalPhotos++;
        this.stats.lastUpdated = new Date();
        this.updateStats();
       
        console.log(`✅ Добавлено: ${newPoints} новых, ${confirmedPoints} подтверждено точек`);
        return { newPoints, confirmedPoints, photoId };
    }
   
    // 🔥 ОБНОВЛЯЕМ СТАТИСТИКУ
    updateStats() {
        this.stats.totalPoints = this.allPoints.size;
       
        let confirmed3 = 0, confirmed2 = 0, confirmed1 = 0;
       
        for (const point of this.allPoints.values()) {
            if (point.confirmedCount >= 3) {
                confirmed3++;
            } else if (point.confirmedCount >= 2) {
                confirmed2++;
            } else {
                confirmed1++;
            }
        }
       
        this.stats.confirmed3 = confirmed3;
        this.stats.confirmed2 = confirmed2;
        this.stats.confirmed1 = confirmed1;
       
        console.log(`📊 Аккумулятор: ${this.stats.totalPoints} точек (${confirmed3}🔴/${confirmed2}🟠/${confirmed1}🔵)`);
    }
   
    // 🔥 ПОЛУЧАЕМ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
    getVisualizationData() {
        const points = [];
       
        for (const point of this.allPoints.values()) {
            // Определяем цвет по подтверждениям
            let color, size, status;
           
            if (point.confirmedCount >= 3) {
                color = '#FF0000'; // 🔴
                size = 10;
                status = 'high_confidence';
            } else if (point.confirmedCount >= 2) {
                color = '#FF6B00'; // 🟠
                size = 7;
                status = 'medium_confidence';
            } else {
                color = '#2196F3'; // 🔵
                size = 5;
                status = 'low_confidence';
            }
           
            points.push({
                id: point.id,
                x: point.x,
                y: point.y,
                color: color,
                size: size,
                confirmations: point.confirmedCount,
                confidence: point.confidence,
                status: status,
                firstSeen: point.firstSeen,
                lastSeen: point.lastSeen,
                photoCount: point.seenInPhotos.length,
                isNew: point.isNew || false
            });
        }
       
        return {
            id: this.id,
            userId: this.userId,
            name: this.name,
            points: points,
            stats: this.stats,
            photos: this.photos,
            totalPoints: this.stats.totalPoints,
            visualizationType: 'accumulative'
        };
    }
   
    // 🔥 ГЕОМЕТРИЧЕСКОЕ СРАВНЕНИЕ С ДРУГИМ АККУМУЛЯТОРОМ
    compareWith(otherAccumulator) {
        const myPoints = this.getVisualizationData().points;
        const otherPoints = otherAccumulator.getVisualizationData().points;
       
        const SIMILARITY_THRESHOLD = 30; // 30px
       
        let matches = 0;
        let totalCompared = Math.min(myPoints.length, otherPoints.length);
       
        // Простое сравнение по расстоянию
        for (const myPoint of myPoints) {
            for (const otherPoint of otherPoints) {
                const distance = Math.sqrt(
                    Math.pow(otherPoint.x - myPoint.x, 2) +
                    Math.pow(otherPoint.y - myPoint.y, 2)
                );
               
                if (distance < SIMILARITY_THRESHOLD) {
                    matches++;
                    break;
                }
            }
        }
       
        const similarity = totalCompared > 0 ? matches / totalCompared : 0;
       
        return {
            similarity: similarity,
            matches: matches,
            totalCompared: totalCompared,
            decision: similarity > 0.6 ? 'same' : 'different'
        };
    }
   
    // 🔥 ИНФОРМАЦИЯ ОБ АККУМУЛЯТОРЕ
    getInfo() {
        return {
            id: this.id,
            userId: this.userId,
            name: this.name,
            stats: this.stats,
            photosCount: this.photos.length,
            lastPhoto: this.photos.length > 0 ? this.photos[this.photos.length - 1].timestamp : null,
            createdAt: this.stats.createdAt
        };
    }
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
       
        // 🔥 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ
        if (GeometricHashAlgorithm) {
            this.geometricAlgorithm = new GeometricHashAlgorithm({
                minSimilarity: this.config.similarityThreshold,
                debug: this.config.debug
            });
        }
       
        // 🔥 АККУМУЛЯТОРЫ ДЛЯ КАЖДОГО ПОЛЬЗОВАТЕЛЯ
        this.accumulators = new Map(); // userId -> AccumulativeFootprint
       
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
            algorithm: 'accumulative_model_v1.0',
            createdAt: new Date()
        };
       
        this.ensureDirectories();
        console.log('✅ SimpleFootprintManager с аккумуляционной моделью инициализирован');
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: ДОБАВЛЕНИЕ ФОТО
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 АККУМУЛЯЦИОННОЕ ДОБАВЛЕНИЕ ФОТО для ${userId}`);
       
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
           
            // 2. Получаем или создаем аккумулятор
            let accumulator = this.accumulators.get(userId);
            if (!accumulator) {
                accumulator = new AccumulativeFootprint(userId);
                this.accumulators.set(userId, accumulator);
                this.systemStats.totalAccumulators++;
                console.log(`✅ Создан новый аккумулятор для ${userId}`);
            }
           
            // 3. Добавляем точки в аккумулятор
            const addResult = accumulator.addPhoto(points, {
                ...photoInfo,
                source: 'telegram_bot',
                analysisType: 'shoe_protector',
                timestamp: new Date()
            });
           
            // 4. ГЕОМЕТРИЧЕСКОЕ СРАВНЕНИЕ (если уже есть фото)
            let comparisonResult = null;
            if (accumulator.stats.totalPhotos > 1) {
                comparisonResult = await this.performGeometricComparison(points, accumulator);
            }
           
            // 5. ВИЗУАЛИЗАЦИЯ АККУМУЛЯТОРА
            let visualizationResult = null;
            if (this.visualizer) {
                visualizationResult = await this.visualizeAccumulativeFootprint(
                    accumulator,
                    comparisonResult,
                    photoInfo
                );
            }
           
            // 6. ОБНОВЛЯЕМ СТАТИСТИКУ
            this.systemStats.totalPhotos++;
            if (this.systemStats.totalUsers === 0) {
                this.systemStats.totalUsers = this.accumulators.size;
            }
           
            // 7. ОТПРАВКА В TELEGRAM (если нужно)
            let telegramResponse = null;
            if (bot && chatId && visualizationResult) {
                telegramResponse = await this.sendAccumulativeVisualizationToTelegram(
                    accumulator,
                    visualizationResult,
                    comparisonResult,
                    addResult,
                    bot,
                    chatId
                );
            }
           
            // 8. СОХРАНЕНИЕ (если включено)
            if (this.config.autoSave) {
                await this.saveAccumulator(userId);
            }
           
            // 9. ФОРМИРУЕМ ОТВЕТ
            const result = {
                success: true,
                userId: userId,
                accumulatorId: accumulator.id,
                pointsAdded: addResult.newPoints,
                pointsConfirmed: addResult.confirmedPoints,
                totalPoints: accumulator.stats.totalPoints,
                totalPhotos: accumulator.stats.totalPhotos,
                stats: accumulator.stats,
                visualization: visualizationResult,
                comparison: comparisonResult,
                telegramSent: !!telegramResponse,
                method: 'accumulative'
            };
           
            console.log(`✅ Фото добавлено в аккумулятор:`);
            console.log(`   Всего точек: ${accumulator.stats.totalPoints}`);
            console.log(`   🔴 3+ подтверждений: ${accumulator.stats.confirmed3}`);
            console.log(`   🟠 2 подтверждения: ${accumulator.stats.confirmed2}`);
            console.log(`   🔵 1 подтверждение: ${accumulator.stats.confirmed1}`);
           
            if (comparisonResult) {
                console.log(`   🎯 Геометрическое сходство: ${(comparisonResult.similarity * 100).toFixed(1)}%`);
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
   
    // 🔥 ГЕОМЕТРИЧЕСКОЕ СРАВНЕНИЕ
    async performGeometricComparison(newPoints, accumulator) {
        if (!this.geometricAlgorithm || newPoints.length < 3) {
            console.log('⚠️ Недостаточно точек или нет алгоритма для сравнения');
            return null;
        }
       
        try {
            // Получаем точки из аккумулятора (только с 2+ подтверждениями)
            const accumPoints = [];
            for (const point of accumulator.allPoints.values()) {
                if (point.confirmedCount >= 2) {
                    accumPoints.push({
                        x: point.x,
                        y: point.y,
                        confidence: point.confidence,
                        id: point.id
                    });
                }
            }
           
            if (accumPoints.length < 3) {
                console.log('⚠️ В аккумуляторе мало подтвержденных точек');
                return null;
            }
           
            console.log(`🔍 Геометрическое сравнение: ${newPoints.length} новых vs ${accumPoints.length} подтвержденных`);
           
            const result = this.geometricAlgorithm.comparePoints(
                newPoints,
                accumPoints,
                'Новое фото',
                'Аккумулятор'
            );
           
            return {
                similarity: result.similarity,
                decision: result.decision,
                matches: result.matches || [],
                stats: result.stats || {},
                method: 'geometric_hash'
            };
           
        } catch (error) {
            console.log(`⚠️ Ошибка геометрического сравнения: ${error.message}`);
            return null;
        }
    }
   
    // 🔥 ВИЗУАЛИЗАЦИЯ АККУМУЛЯТОРА
    async visualizeAccumulativeFootprint(accumulator, comparisonResult = null, photoInfo = {}) {
        if (!this.visualizer) {
            console.log('⚠️ Визуализатор не доступен');
            return null;
        }
       
        try {
            console.log(`🎨 Визуализация аккумуляторного следа...`);
           
            const data = accumulator.getVisualizationData();
           
            const result = await this.visualizer.visualizeAccumulativeFootprint(
                data,
                {
                    comparisonResult: comparisonResult,
                    photoInfo: photoInfo,
                    showStats: true,
                    showLegend: true,
                    filename: `accumulative_${accumulator.userId}_${Date.now()}.png`
                }
            );
           
            console.log(`✅ Визуализация создана: ${result?.path || 'нет пути'}`);
            return result;
           
        } catch (error) {
            console.log(`⚠️ Ошибка визуализации: ${error.message}`);
            return null;
        }
    }
   
    // 🔥 ИЗВЛЕЧЕНИЕ ТОЧЕК ИЗ АНАЛИЗА
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
   
    // 🔥 ОТПРАВКА В TELEGRAM
    async sendAccumulativeVisualizationToTelegram(accumulator, visualizationResult,
                                                  comparisonResult, addResult, bot, chatId) {
        try {
            if (!visualizationResult || !visualizationResult.path || !fs.existsSync(visualizationResult.path)) {
                console.log('⚠️ Нет файла визуализации для отправки');
                return null;
            }
           
            const stats = accumulator.stats;
           
            let caption = `🎯 АККУМУЛЯТОРНЫЙ СЛЕД\n\n`;
            caption += `📊 Всего точек: ${stats.totalPoints}\n`;
            caption += `🔴 3+ подтверждений: ${stats.confirmed3}\n`;
            caption += `🟠 2 подтверждения: ${stats.confirmed2}\n`;
            caption += `🔵 1 подтверждение: ${stats.confirmed1}\n`;
            caption += `📸 Всего фото: ${stats.totalPhotos}\n\n`;
           
            if (comparisonResult) {
                caption += `🎯 Геометрическое сходство: ${(comparisonResult.similarity * 100).toFixed(1)}%\n`;
                caption += `🤔 Решение: ${comparisonResult.decision === 'same' ? 'ОДНА обувь ✅' : 'Разная обувь'}\n\n`;
            }
           
            caption += `📈 Добавлено: ${addResult.newPoints} новых, ${addResult.confirmedPoints} подтверждено\n`;
            caption += `💾 Аккумулятор: ${accumulator.id.slice(0, 8)}`;
           
            // Очистка Markdown
            const cleanMarkdown = (text) => text
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/__/g, '')
                .replace(/_/g, '')
                .replace(/`/g, '');
           
            await bot.sendPhoto(chatId, visualizationResult.path, {
                caption: cleanMarkdown(caption),
                parse_mode: 'HTML'
            });
           
            console.log('✅ Визуализация отправлена в Telegram');
            return { success: true, caption: caption };
           
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
           
            const accumulatorsDir = path.join(this.config.dbPath, 'accumulators');
            if (!fs.existsSync(accumulatorsDir)) {
                fs.mkdirSync(accumulatorsDir, { recursive: true });
            }
           
            const data = {
                id: accumulator.id,
                userId: accumulator.userId,
                name: accumulator.name,
                allPoints: Array.from(accumulator.allPoints.entries()),
                photos: accumulator.photos,
                stats: accumulator.stats,
                _version: '1.0-accumulative',
                _savedAt: new Date().toISOString()
            };
           
            const filename = `accumulator_${userId}_${Date.now()}.json`;
            const filePath = path.join(accumulatorsDir, filename);
           
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
           
            console.log(`💾 Аккумулятор сохранен: ${filePath}`);
            return { success: true, filePath };
           
        } catch (error) {
            console.log(`⚠️ Ошибка сохранения аккумулятора: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
   
    // 🔥 ЗАГРУЗКА АККУМУЛЯТОРА
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
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
           
            // Создаем аккумулятор
            const accumulator = new AccumulativeFootprint(userId);
            accumulator.id = data.id || accumulator.id;
            accumulator.name = data.name || accumulator.name;
           
            // Восстанавливаем точки
            if (Array.isArray(data.allPoints)) {
                for (const [pointId, pointData] of data.allPoints) {
                    accumulator.allPoints.set(pointId, pointData);
                }
            }
           
            // Восстанавливаем фото
            if (Array.isArray(data.photos)) {
                accumulator.photos = data.photos;
            }
           
            // Восстанавливаем статистику
            if (data.stats) {
                accumulator.stats = data.stats;
                // Восстанавливаем даты
                if (typeof accumulator.stats.createdAt === 'string') {
                    accumulator.stats.createdAt = new Date(accumulator.stats.createdAt);
                }
                if (typeof accumulator.stats.lastUpdated === 'string') {
                    accumulator.stats.lastUpdated = new Date(accumulator.stats.lastUpdated);
                }
            }
           
            // Обновляем статистику
            accumulator.updateStats();
           
            // Сохраняем в менеджере
            this.accumulators.set(userId, accumulator);
           
            console.log(`📂 Загружен аккумулятор для ${userId}: ${accumulator.stats.totalPoints} точек`);
            return accumulator;
           
        } catch (error) {
            console.log(`⚠️ Ошибка загрузки аккумулятора: ${error.message}`);
            return false;
        }
    }
   
    // 🔥 ПОЛУЧЕНИЕ ИНФОРМАЦИИ ОБ АККУМУЛЯТОРЕ
    getAccumulatorInfo(userId) {
        const accumulator = this.accumulators.get(userId);
        if (!accumulator) {
            return { exists: false, message: 'Аккумулятор не найден' };
        }
       
        return {
            exists: true,
            info: accumulator.getInfo(),
            stats: accumulator.stats,
            canVisualize: true
        };
    }
   
    // 🔥 ПОЛУЧЕНИЕ СИСТЕМНОЙ СТАТИСТИКИ
    getSystemStats() {
        return {
            ...this.systemStats,
            activeAccumulators: this.accumulators.size,
            algorithm: 'Аккумуляционная модель v1.0'
        };
    }
   
    // 🔥 СОЗДАНИЕ ДИРЕКТОРИЙ
    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'accumulators'),
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
   
    // 🔥 ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
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
   
    // 🔥 ТЕСТОВЫЙ МЕТОД: ГЕНЕРАЦИЯ ТЕСТОВОГО АККУМУЛЯТОРА
    generateTestAccumulator(userId, pointCount = 50) {
        const accumulator = new AccumulativeFootprint(userId);
       
        // Генерируем тестовые точки
        for (let i = 0; i < pointCount; i++) {
            const point = {
                x: Math.random() * 800 + 100,
                y: Math.random() * 600 + 100,
                confidence: 0.5 + Math.random() * 0.5
            };
           
            const pointId = accumulator.getPointId(point);
            accumulator.allPoints.set(pointId, {
                id: pointId,
                x: point.x,
                y: point.y,
                confidence: point.confidence,
                seenInPhotos: [`test_photo_${Math.floor(Math.random() * 3) + 1}`],
                confirmedCount: Math.floor(Math.random() * 3) + 1,
                firstSeen: new Date(),
                lastSeen: new Date()
            });
        }
       
        accumulator.updateStats();
        this.accumulators.set(userId, accumulator);
       
        console.log(`🧪 Создан тестовый аккумулятор: ${accumulator.stats.totalPoints} точек`);
        return accumulator;
    }
}

module.exports = SimpleFootprintManager;
