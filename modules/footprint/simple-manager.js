// modules/footprint/simple-manager.js
// 🔥 ВЕКТОРНАЯ СИСТЕМА С ПРОСТЫМ АЛГОРИТМОМ (ИСПРАВЛЕНА РЕКУРСИЯ)

const fs = require('fs');
const path = require('path');

// 🔥 ПРОСТОЙ ВЕКТОРНЫЙ АЛГОРИТМ
let VectorAlgorithm;
try {
    VectorAlgorithm = require('./clean/vector-algorithm');
    console.log('✅ Простой векторный алгоритм загружен');
} catch (error) {
    console.log(`⚠️ Ошибка загрузки: ${error.message}`);
    // Фаллбэк
    VectorAlgorithm = class {
        compareFootprints() { return { similar: false, similarity: 0, matches: [] }; }
    };
}

class SimpleFootprintManager {
    constructor(options = {}) {
        console.log('🚀 SimpleFootprintManager создан (ПРОСТАЯ векторная система)');

        this.config = {
            dbPath: options.dbPath || './data/footprints',
            similarityThreshold: options.similarityThreshold || 0.6,
            minPoints: options.minPoints || 5,
            debug: options.debug || false
        };

        // 🔥 АЛГОРИТМ
        this.vectorAlgorithm = new VectorAlgorithm({
            minSimilarity: this.config.similarityThreshold,
            debug: this.config.debug
        });

        // 🔥 ХРАНИЛИЩЕ
        this.userModels = new Map(); // userId -> { footprints: [], points: Map }
        this.sessions = new Map();

        console.log('✅ SimpleFootprintManager готов');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО для ${userId}`);

        try {
            // Извлекаем точки
            const points = this.extractPoints(analysis);
            if (points.length < this.config.minPoints) {
                return { success: false, error: `Мало точек: ${points.length}` };
            }

            // Получаем модель пользователя
            let model = this.userModels.get(userId);
            if (!model) {
                model = this._createUserModel(userId);
                this.userModels.set(userId, model);
                console.log(`🆕 Создана новая модель для ${userId}`);
            }

            // Обрабатываем
            const result = await this.processFootprint(model, points, photoInfo);

            // Создаем сессию для совместимости
            let session = this.sessions.get(userId);
            if (!session) {
                session = this._createNewSession(userId);
                this.sessions.set(userId, session);
            }

            // Визуализация
            let vizResult = null;
            if (bot && chatId) {
                vizResult = await this.visualizeAndSend(model, result, bot, chatId);
            }

            return {
                success: true,
                ...result,
                sessionId: session.id,
                visualization: vizResult
            };

        } catch (error) {
            console.log(`❌ Ошибка: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // 🔥 ОБРАБОТКА СЛЕДА
    async processFootprint(model, points, photoInfo) {
        console.log(`🔄 Обработка ${points.length} точек`);

        // Создаем векторный отпечаток
        const vectorPrint = this.vectorAlgorithm.createFootprint(points, `fp_${Date.now()}`);

        const footprint = {
            id: `fp_${Date.now()}`,
            points: points,
            vectorPrint: vectorPrint,
            timestamp: new Date(),
            photoInfo: photoInfo
        };

        model.footprints.push(footprint);

        // Если это первый след
        if (model.footprints.length === 1) {
            return this.handleFirstFootprint(model, footprint);
        }

        // Сравниваем с предыдущими
        return this.handleComparison(model, footprint);
    }

    // 🔥 ПЕРВЫЙ СЛЕД
    handleFirstFootprint(model, footprint) {
        console.log(`👣 Первый след (${footprint.vectorPrint.length} точек)`);

        // Добавляем все точки как неподтвержденные
        footprint.vectorPrint.forEach(point => {
            const pointId = `pt_${model.nextId++}`;
            model.points.set(pointId, {
                id: pointId,
                x: point.x,
                y: point.y,
                confidence: point.confidence,
                confirmations: 1,
                seenIn: [footprint.id],
                color: 'blue',
                vectorId: point.vectorId
            });
        });

        return {
            isFirst: true,
            pointsAdded: footprint.vectorPrint.length,
            totalPoints: model.points.size,
            decision: 'new',
            similarity: 0
        };
    }

    // 🔥 СРАВНЕНИЕ
    handleComparison(model, newFootprint) {
        console.log(`🔍 Сравниваю с ${model.footprints.length - 1} существующими`);

        let bestSimilarity = 0;
        let bestMatches = [];

        // Сравниваем со всеми существующими
        for (const existing of model.footprints.slice(0, -1)) {
            const comparison = this.vectorAlgorithm.compareFootprints(
                existing.vectorPrint,
                newFootprint.vectorPrint,
                'Существующий',
                'Новый'
            );

            if (comparison.similarity > bestSimilarity) {
                bestSimilarity = comparison.similarity;
                bestMatches = comparison.matches || [];
            }
        }

        console.log(`📊 Лучшее сходство: ${(bestSimilarity * 100).toFixed(1)}%`);

        if (bestSimilarity >= this.config.similarityThreshold) {
            return this.mergeFootprint(model, newFootprint, bestMatches, bestSimilarity);
        } else {
            return this.addNewFootprint(model, newFootprint);
        }
    }

    // 🔥 ОБЪЕДИНЕНИЕ (совпадающие следы)
    mergeFootprint(model, footprint, matches, similarity) {
        console.log(`✅ Объединяю следы (${(similarity * 100).toFixed(1)}% сходство)`);

        // 1. Обновляем существующие точки
        let confirmedCount = 0;
        matches.forEach(match => {
            if (match.point1?.vectorId) {
                // Ищем точку по vectorId
                for (const [pointId, pointData] of model.points) {
                    if (pointData.vectorId === match.point1.vectorId) {
                        pointData.seenIn.push(footprint.id);
                        pointData.confirmations = pointData.seenIn.length;
                        pointData.lastSeen = new Date();

                        // Обновляем цвет
                        if (pointData.confirmations >= 3) {
                            pointData.color = 'red';
                        } else if (pointData.confirmations === 2) {
                            pointData.color = 'orange';
                        }

                        confirmedCount++;
                        break;
                    }
                }
            }
        });

        // 2. Добавляем абсолютно новые точки
        let newCount = 0;
        footprint.vectorPrint.forEach(point => {
            // Проверяем, есть ли уже такая точка
            let exists = false;
            for (const pointData of model.points.values()) {
                if (pointData.vectorId === point.vectorId) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                const pointId = `pt_${model.nextId++}`;
                model.points.set(pointId, {
                    id: pointId,
                    x: point.x,
                    y: point.y,
                    confidence: point.confidence,
                    confirmations: 1,
                    seenIn: [footprint.id],
                    color: 'blue',
                    vectorId: point.vectorId
                });
                newCount++;
            }
        });

        // Статистика
        const stats = this.calculateStats(model);

        console.log(`📈 Результат:`);
        console.log(`   Подтверждено: ${confirmedCount} точек`);
        console.log(`   Новых: ${newCount} точек`);
        console.log(`   Всего: ${model.points.size} точек`);
        console.log(`   🔴 3+: ${stats.confirmed3}`);
        console.log(`   🟠 2: ${stats.confirmed2}`);
        console.log(`   🔵 1: ${stats.confirmed1}`);

        return {
            isFirst: false,
            similarity: similarity,
            decision: 'same',
            pointsConfirmed: confirmedCount,
            pointsAdded: newCount,
            totalPoints: model.points.size,
            stats: stats
        };
    }

    // 🔥 НОВЫЙ СЛЕД (другая обувь)
    addNewFootprint(model, footprint) {
        console.log(`🆕 Новая обувь`);

        // Просто добавляем точки как новые
        let newCount = 0;
        footprint.vectorPrint.forEach(point => {
            const pointId = `pt_${model.nextId++}`;
            model.points.set(pointId, {
                id: pointId,
                x: point.x,
                y: point.y,
                confidence: point.confidence,
                confirmations: 1,
                seenIn: [footprint.id],
                color: 'blue',
                vectorId: point.vectorId
            });
            newCount++;
        });

        return {
            isFirst: false,
            similarity: 0,
            decision: 'different',
            pointsAdded: newCount,
            totalPoints: model.points.size
        };
    }

    // 🔥 РАСЧЕТ СТАТИСТИКИ
    calculateStats(model) {
        let confirmed3 = 0, confirmed2 = 0, confirmed1 = 0;

        for (const pointData of model.points.values()) {
            if (pointData.confirmations >= 3) confirmed3++;
            else if (pointData.confirmations === 2) confirmed2++;
            else confirmed1++;
        }

        return { confirmed3, confirmed2, confirmed1 };
    }

    // 🔥 ИЗВЛЕЧЕНИЕ ТОЧЕК
    extractPoints(analysis) {
        const points = [];
        const predictions = analysis.predictions || [];

        for (const pred of predictions) {
            if (pred.class === 'shoe-protector' && pred.points?.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);

                points.push({
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2,
                    confidence: pred.confidence || 0.5
                });
            }
        }

        return points.filter(p => 
            p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y)
        );
    }

    // 🔥 ВИЗУАЛИЗАЦИЯ
    async visualizeAndSend(model, result, bot, chatId) {
        try {
            const ClusterVisualizer = require('./visualizations/cluster-visualizer');
            const visualizer = new ClusterVisualizer();

            const vizData = this.getVisualizationData(model);
            const vizResult = await visualizer.visualizeAccumulativeModel(vizData, {
                filename: `accum_${model.userId}_${Date.now()}.png`
            });

            if (vizResult?.path && fs.existsSync(vizResult.path)) {
                const caption = this.createCaption(result, model);
                await bot.sendPhoto(chatId, vizResult.path, {
                    caption: this.cleanMarkdown(caption),
                    parse_mode: 'HTML'
                });
                return vizResult;
            }
        } catch (error) {
            console.log(`⚠️ Ошибка визуализации: ${error.message}`);
        }
        return null;
    }

    // 🔥 ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
    getVisualizationData(model) {
        const points = [];
        for (const pointData of model.points.values()) {
            points.push({
                x: pointData.x,
                y: pointData.y,
                confirmations: pointData.confirmations,
                color: pointData.color,
                confidence: pointData.confidence
            });
        }

        const stats = this.calculateStats(model);

        return {
            points: points,
            totalPoints: points.length,
            totalFootprints: model.footprints.length,
            stats: stats,
            modelId: model.id
        };
    }

    // 🔥 ПОДПИСЬ ДЛЯ ТЕЛЕГРАМ
    createCaption(result, model) {
        let caption = '';
        
        if (result.isFirst) {
            caption = `👣 ПЕРВЫЙ СЛЕД\n${result.pointsAdded} точек добавлено`;
        } else if (result.decision === 'same') {
            caption = `✅ ОДНА ОБУВЬ\nСходство: ${(result.similarity * 100).toFixed(1)}%\n`;
            caption += `Подтверждено: ${result.pointsConfirmed} точек\n`;
            caption += `Новых: ${result.pointsAdded} точек\n`;
            caption += `Всего: ${result.totalPoints} точек`;
        } else {
            caption = `🆕 НОВАЯ ОБУВЬ\nДобавлено: ${result.pointsAdded} точек`;
        }

        return caption;
    }

    cleanMarkdown(text) {
        return text.replace(/[_\*\[\]\(\)~`>#\+\-=|{}.!]/g, '\\$&');
    }

    // ============================================
    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (ИСПРАВЛЕНЫ!)
    // ============================================

    // 🔥 СОЗДАНИЕ МОДЕЛИ ПОЛЬЗОВАТЕЛЯ (ПРИВАТНЫЙ МЕТОД)
    _createUserModel(userId) {
        return {
            id: `model_${userId}_${Date.now()}`,
            userId: userId,
            footprints: [],
            points: new Map(),
            nextId: 1,
            createdAt: new Date()
        };
    }

    // 🔥 СОЗДАНИЕ НОВОЙ СЕССИИ (ПРИВАТНЫЙ МЕТОД)
    _createNewSession(userId, name = null) {
        const session = {
            id: `${userId}_${Date.now()}`,
            userId: userId,
            photos: [],
            lastActivity: new Date()
        };
        
        if (name) {
            session.name = name;
        }
        
        return session;
    }

    // 🔥 МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ (ПУБЛИЧНЫЕ)
    getActiveSession(userId) {
        return this.sessions.get(userId) || null;
    }

    getSessionInfo(userId) {
        const session = this.sessions.get(userId);
        if (!session) return null;
        
        return {
            id: session.id,
            userId: session.userId,
            photos: session.photos.length,
            lastActivity: session.lastActivity,
            name: session.name || `Сессия_${session.id.slice(-6)}`
        };
    }

    hasSession(userId) {
        return this.sessions.has(userId);
    }

    // 🔥 СОЗДАНИЕ СЕССИИ (ПУБЛИЧНЫЙ МЕТОД - БЕЗ РЕКУРСИИ!)
    createSession(userId, name = null) {
        // Проверяем, нет ли уже сессии
        if (this.sessions.has(userId)) {
            console.log(`⚠️ Сессия для ${userId} уже существует`);
            return this.sessions.get(userId);
        }

        // Создаем новую сессию
        const session = this._createNewSession(userId, name);
        this.sessions.set(userId, session);
        
        console.log(`✅ Создана сессия: ${session.id} для ${userId}`);
        return session;
    }

    updateLastActivity(userId) {
        const session = this.sessions.get(userId);
        if (session) {
            session.lastActivity = new Date();
            return true;
        }
        return false;
    }
}

module.exports = SimpleFootprintManager;
