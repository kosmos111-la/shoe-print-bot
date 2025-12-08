// modules/footprint/footprint-manager.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const DigitalFootprint = require('./digital-footprint');
const FootprintDatabase = require('./footprint-database');
const fs = require('fs');
const path = require('path');

class FootprintManager {
    constructor(options = {}) {
        this.database = new FootprintDatabase(options.dbPath);
       
        // 🔥 ИСПРАВЛЕНИЕ 1: Храним модели по userId
        this.userSessions = new Map(); // userId -> {session, model}
       
        // 🔥 ИСПРАВЛЕНИЕ 2: Настройки автосовмещения ВКЛЮЧЕНЫ по умолчанию
        this.alignmentConfig = {
            enabled: options.autoAlignment !== false, // true по умолчанию
            minPointsForAlignment: 3,
            minAlignmentScore: 0.5,
            maxIterations: 100
        };

        console.log('🔄 FootprintManager создан с автосовмещением');
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Начать новую сессию
    startNewSession(userId, sessionName = null) {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
       
        // 🔥 СОЗДАЕМ МОДЕЛЬ сразу при старте сессии
        const model = new DigitalFootprint({
            name: sessionName || `Сессия_${new Date().toLocaleDateString('ru-RU')}`,
            userId: userId,
            sessionId: sessionId
        });

        const session = {
            id: sessionId,
            userId: userId,
            name: sessionName || `Сессия_${new Date().toLocaleDateString('ru-RU')}`,
            startTime: new Date(),
            analyses: [],
            photos: [],
            stats: {
                totalPhotos: 0,
                successfulAlignments: 0,
                failedAlignments: 0,
                avgAlignmentScore: 0
            }
        };

        // 🔥 СОХРАНЯЕМ И СЕССИЮ И МОДЕЛЬ
        this.userSessions.set(userId, {
            session: session,
            model: model
        });

        console.log(`🆕 Новая сессия для пользователя ${userId}: ${session.name}`);
        console.log(`📦 Создана модель: ${model.name}`);
        console.log(`🎯 Автосовмещение: ${this.alignmentConfig.enabled ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);

        return session;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Получить модель пользователя
    getModel(userId) {
        if (!this.userSessions.has(userId)) {
            console.log(`❌ Нет сессии для пользователя ${userId}`);
            return null;
        }
       
        const userSession = this.userSessions.get(userId);
        return userSession.model;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Получить сессию пользователя
    getSession(userId) {
        if (!this.userSessions.has(userId)) {
            return null;
        }
       
        return this.userSessions.get(userId).session;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Добавить фото в сессию
    async addPhotoToSession(analysis, photoPath = null, sourceInfo = {}) {
        const userId = sourceInfo.userId;
       
        if (!userId) {
            console.log('❌ Нет userId в sourceInfo');
            return { success: false, error: 'No userId' };
        }

        // Проверяем есть ли сессия
        if (!this.userSessions.has(userId)) {
            console.log(`❌ У пользователя ${userId} нет активной сессии`);
            return { success: false, error: 'No active session' };
        }

        const userData = this.userSessions.get(userId);
        const session = userData.session;
        const model = userData.model;

        console.log(`\n📸 Добавляю фото в сессию пользователя ${userId}`);
        console.log(`📊 Текущая модель: ${model.nodes.size} узлов`);

        // 🔥 РЕШАЕМ: использовать автосовмещение или нет
        let result;
        const shouldAlign = this.shouldUseAlignment(model);

        if (shouldAlign) {
            console.log('🎯 Использую автосовмещение...');
            result = await this.addWithAlignment(model, analysis, sourceInfo);
        } else {
            console.log('📌 Использую стандартное добавление...');
            result = await this.addStandard(model, analysis, sourceInfo);
        }

        // Обновляем сессию
        session.photos.push({
            timestamp: new Date(),
            analysisId: analysis.id,
            result: result
        });
       
        session.stats.totalPhotos++;
       
        if (result.alignmentScore && result.alignmentScore > 0.5) {
            session.stats.successfulAlignments++;
        }

        console.log(`✅ Результат: ${result.added || 0} добавлено, ${result.merged || 0} объединено`);
        if (result.alignmentScore) {
            console.log(`🎯 Score совмещения: ${(result.alignmentScore * 100).toFixed(1)}%`);
        }

        return result;
    }

    // 🔥 НОВЫЙ МЕТОД: Добавить с автосовмещением
    async addWithAlignment(model, analysis, sourceInfo) {
        try {
            // Используем метод модели с автосовмещением
            return model.addAnalysisWithAlignment(analysis, sourceInfo);
        } catch (error) {
            console.log('❌ Ошибка автосовмещения:', error.message);
            console.log('🔄 Пробую стандартное добавление...');
            return this.addStandard(model, analysis, sourceInfo);
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Стандартное добавление
    async addStandard(model, analysis, sourceInfo) {
        try {
            return model.addAnalysis(analysis, sourceInfo);
        } catch (error) {
            console.log('❌ Ошибка стандартного добавления:', error.message);
            return {
                success: false,
                error: error.message,
                added: 0,
                merged: 0
            };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Решение об использовании совмещения
    shouldUseAlignment(model) {
        // Если автосовмещение выключено в конфиге
        if (!this.alignmentConfig.enabled) {
            return false;
        }

        // Если модель пустая или мало узлов
        if (!model || model.nodes.size < this.alignmentConfig.minPointsForAlignment) {
            return false;
        }

        return true;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Сохранить сессию как модель
    async saveSessionAsModel(modelName = null, userId) {
        if (!userId) {
            console.log('❌ Нет userId для сохранения модели');
            return { success: false, error: 'No userId' };
        }

        if (!this.userSessions.has(userId)) {
            console.log(`❌ У пользователя ${userId} нет активной сессии`);
            return { success: false, error: 'No active session' };
        }

        const userData = this.userSessions.get(userId);
        const session = userData.session;
        const model = userData.model;

        console.log(`💾 Сохраняю модель пользователя ${userId}: "${modelName || model.name}"`);

        // Обновляем имя модели если задано новое
        if (modelName) {
            model.name = modelName;
        }

        // Сохраняем в базу данных
        try {
            const saveResult = this.database.saveFootprint(model);

            if (saveResult.success) {
                console.log(`✅ Модель сохранена с ID: ${saveResult.id}`);
                console.log(`📊 Статистика:`);
                console.log(`   • Узлов: ${model.nodes.size}`);
                console.log(`   • Ребер: ${model.edges.length}`);
                console.log(`   • Оригинальных координат: ${model.originalCoordinates.size}`);
                console.log(`   • Фото в сессии: ${session.photos.length}`);

                // Не удаляем сессию сразу, пользователь может добавить еще фото
                return {
                    success: true,
                    modelId: saveResult.id,
                    modelName: model.name,
                    stats: {
                        nodes: model.nodes.size,
                        edges: model.edges.length,
                        confidence: model.stats.confidence,
                        photosCount: session.photos.length
                    }
                };
            } else {
                console.log('❌ Ошибка сохранения модели:', saveResult.error);
                return { success: false, error: saveResult.error };
            }

        } catch (error) {
            console.log('❌ Исключение при сохранении:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Завершить сессию
    endSession(userId) {
        if (!this.userSessions.has(userId)) {
            return null;
        }

        const userData = this.userSessions.get(userId);
        const session = userData.session;
       
        console.log(`🔚 Завершаю сессию пользователя ${userId}`);
        console.log(`📊 Итоги: ${session.photos.length} фото, ${session.stats.successfulAlignments} совмещений`);

        // Удаляем сессию из памяти
        this.userSessions.delete(userId);

        return {
            sessionId: session.id,
            photosCount: session.photos.length,
            successfulAlignments: session.stats.successfulAlignments,
            modelSaved: false // Модель не сохранена автоматически
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Получить статистику сессии
    getSessionStats(userId) {
        if (!this.userSessions.has(userId)) {
            return null;
        }

        const userData = this.userSessions.get(userId);
        const session = userData.session;
        const model = userData.model;

        return {
            session: {
                id: session.id,
                name: session.name,
                startTime: session.startTime,
                photosCount: session.photos.length,
                stats: session.stats
            },
            model: {
                name: model.name,
                nodeCount: model.nodes.size,
                edgeCount: model.edges.length,
                confidence: model.stats.confidence,
                originalCoordsCount: model.originalCoordinates.size,
                alignmentHistoryCount: model.alignmentHistory.length
            },
            alignmentConfig: this.alignmentConfig
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Включить/выключить автосовмещение
    setAutoAlignment(enabled, userId = null) {
        this.alignmentConfig.enabled = enabled;
       
        if (userId) {
            console.log(`🔧 Автосовмещение для пользователя ${userId}: ${enabled ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);
        } else {
            console.log(`🔧 Автосовмещение для всех: ${enabled ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);
        }
       
        return this.alignmentConfig.enabled;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить все активные сессии
    getActiveSessions() {
        const sessions = [];
        for (const [userId, data] of this.userSessions) {
            sessions.push({
                userId: userId,
                sessionName: data.session.name,
                photosCount: data.session.photos.length,
                nodeCount: data.model.nodes.size
            });
        }
        return sessions;
    }
}

module.exports = FootprintManager;
