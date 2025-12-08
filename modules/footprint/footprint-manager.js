// modules/footprint/footprint-manager.js - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ
const DigitalFootprint = require('./digital-footprint');
const FootprintDatabase = require('./footprint-database');
const PointCloudAligner = require('./point-cloud-aligner');
const fs = require('fs');
const path = require('path');

class FootprintManager {
    constructor(options = {}) {
        this.database = new FootprintDatabase(options.dbPath);
       
        // 🔥 ХРАНИМ ПОЛЬЗОВАТЕЛЕЙ: userId -> {session, model, stats}
        this.userSessions = new Map();
       
        // 🔥 АВТОСОВМЕЩЕНИЕ ВКЛЮЧЕНО ПО УМОЛЧАНИЮ
        this.alignmentConfig = {
            enabled: options.autoAlignment !== false,
            minPointsForAlignment: 3,
            minAlignmentScore: 0.5,
            maxIterations: 100,
            requireConfirmation: false
        };

        console.log('🔄 FootprintManager создан (автосовмещение: ' +
                   (this.alignmentConfig.enabled ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО') + ')');
    }

    // 🔥 1. НАЧАТЬ НОВУЮ СЕССИЮ (создает модель в памяти)
    startNewSession(userId, sessionName = null) {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
       
        // СОЗДАЕМ МОДЕЛЬ В ПАМЯТИ
        const model = new DigitalFootprint({
            id: `model_${Date.now()}_${userId}`,
            name: sessionName || `Модель_${new Date().toLocaleDateString('ru-RU')}`,
            userId: userId,
            sessionId: sessionId
        });

        // СОЗДАЕМ СЕССИЮ
        const session = {
            id: sessionId,
            userId: userId,
            name: sessionName || `Сессия_${new Date().toLocaleDateString('ru-RU')}`,
            startTime: new Date(),
            photos: [],
            analyses: [],
            stats: {
                totalPhotos: 0,
                successfulAlignments: 0,
                failedAlignments: 0,
                avgAlignmentScore: 0,
                lastPhotoAdded: null
            }
        };

        // СОХРАНЯЕМ
        this.userSessions.set(userId, {
            session: session,
            model: model,
            stats: {
                modelsCreated: 0,
                lastSaved: null
            }
        });

        console.log(`🆕 Новая сессия для ${userId}: "${session.name}"`);
        console.log(`📦 Создана модель в памяти: "${model.name}"`);
        console.log(`🎯 Узлов: 0 (будет добавлено с фото)`);

        return session;
    }

    // 🔥 2. ДОБАВИТЬ ФОТО В СЕССИЮ (с автосовмещением)
    async addPhotoToSession(analysis, photoPath = null, sourceInfo = {}) {
        const userId = sourceInfo.userId;
       
        if (!userId) {
            console.log('❌ Нет userId в sourceInfo');
            return { success: false, error: 'No userId' };
        }

        // ПРОВЕРЯЕМ СЕССИЮ
        if (!this.userSessions.has(userId)) {
            console.log(`⚠️ У ${userId} нет сессии, создаю новую...`);
            this.startNewSession(userId, 'Автосозданная сессия');
        }

        const userData = this.userSessions.get(userId);
        const session = userData.session;
        const model = userData.model;

        console.log(`\n📸 ===== ДОБАВЛЕНИЕ ФОТО =====`);
        console.log(`👤 Пользователь: ${userId}`);
        console.log(`📁 Сессия: ${session.name}`);
        console.log(`📦 Модель: ${model.name} (${model.nodes.size} узлов)`);

        // 🔥 ДИАГНОСТИКА: что пришло в analysis
        console.log('🔍 Анализ данных:');
        if (analysis.predictions) {
            console.log(`  - predictions: ${analysis.predictions.length}`);
            const protectors = analysis.predictions.filter(p => p.class === 'shoe-protector');
            console.log(`  - protectors: ${protectors.length}`);
           
            if (protectors.length > 0 && protectors[0].points) {
                console.log(`  - пример точки: x=${protectors[0].points[0]?.x}, y=${protectors[0].points[0]?.y}`);
            }
        }

        // УЛУЧШАЕМ sourceInfo
        const enhancedSourceInfo = {
            ...sourceInfo,
            sessionId: session.id,
            photoPath: photoPath,
            timestamp: new Date(),
            photoQuality: sourceInfo.photoQuality || 0.7,
            localPath: photoPath
        };

        let result;

        // 🔥 РЕШЕНИЕ: АВТОСОВМЕЩЕНИЕ ИЛИ СТАНДАРТ?
        const shouldUseAlignment = this.shouldUseAlignment(model, analysis);

        if (shouldUseAlignment) {
            console.log('🎯 ЗАПУСКАЮ АВТОСОВМЕЩЕНИЕ...');
            result = await this.addWithAlignment(model, analysis, enhancedSourceInfo);
        } else {
            console.log('📌 СТАНДАРТНОЕ ДОБАВЛЕНИЕ...');
            result = await this.addStandard(model, analysis, enhancedSourceInfo);
        }

        // 🔥 ОБНОВЛЯЕМ СТАТИСТИКУ
        session.photos.push({
            timestamp: new Date(),
            analysisId: analysis.id || `analysis_${Date.now()}`,
            path: photoPath,
            result: result
        });

        session.stats.totalPhotos++;
        session.stats.lastPhotoAdded = new Date();

        if (result.alignmentScore) {
            if (result.alignmentScore > this.alignmentConfig.minAlignmentScore) {
                session.stats.successfulAlignments++;
                console.log(`✅ УСПЕШНОЕ СОВМЕЩЕНИЕ! Score: ${(result.alignmentScore * 100).toFixed(1)}%`);
            } else {
                session.stats.failedAlignments++;
                console.log(`⚠️ СОВМЕЩЕНИЕ НЕ УДАЛОСЬ. Score: ${(result.alignmentScore * 100).toFixed(1)}%`);
            }

            // Средний score
            const totalAlignments = session.stats.successfulAlignments + session.stats.failedAlignments;
            if (totalAlignments > 0) {
                session.stats.avgAlignmentScore =
                    (session.stats.avgAlignmentScore * (totalAlignments - 1) + result.alignmentScore) / totalAlignments;
            }
        }

        console.log(`📊 Результат:`);
        console.log(`  - Добавлено узлов: ${result.added || 0}`);
        console.log(`  - Объединено узлов: ${result.merged || 0}`);
        console.log(`  - Всего узлов в модели: ${model.nodes.size}`);
        console.log(`  - Оригинальных координат: ${model.originalCoordinates.size}`);

        return result;
    }

    // 🔥 3. АВТОСОВМЕЩЕНИЕ
    async addWithAlignment(model, analysis, sourceInfo) {
        try {
            // Используем метод модели с автосовмещением
            return model.addAnalysisWithAlignment(analysis, sourceInfo);
        } catch (error) {
            console.log('❌ Ошибка автосовмещения:', error.message);
            console.log('🔄 Пробую стандартное добавление...');
            return await this.addStandard(model, analysis, sourceInfo);
        }
    }

    // 🔥 4. СТАНДАРТНОЕ ДОБАВЛЕНИЕ
    async addStandard(model, analysis, sourceInfo) {
        try {
            return model.addAnalysis(analysis, sourceInfo);
        } catch (error) {
            console.log('❌ Ошибка стандартного добавления:', error.message);
            return {
                success: false,
                error: error.message,
                added: 0,
                merged: 0,
                totalNodes: model.nodes.size
            };
        }
    }

    // 🔥 5. РЕШЕНИЕ: использовать автосовмещение?
    shouldUseAlignment(model, analysis) {
        // 1. Если выключено в конфиге
        if (!this.alignmentConfig.enabled) {
            console.log('📌 Автосовмещение выключено в конфиге');
            return false;
        }

        // 2. Если модель пустая
        if (model.nodes.size < this.alignmentConfig.minPointsForAlignment) {
            console.log(`📌 Мало узлов для совмещения: ${model.nodes.size} < ${this.alignmentConfig.minPointsForAlignment}`);
            return false;
        }

        // 3. Если в анализе мало протекторов
        const protectors = analysis.predictions?.filter(p => p.class === 'shoe-protector') || [];
        if (protectors.length < this.alignmentConfig.minPointsForAlignment) {
            console.log(`📌 Мало протекторов в анализе: ${protectors.length} < ${this.alignmentConfig.minPointsForAlignment}`);
            return false;
        }

        // 4. Если анализ содержит данные для совмещения
        const hasValidPoints = protectors.some(p =>
            p.points && p.points.length > 0 &&
            p.points[0] && p.points[0].x !== undefined
        );

        if (!hasValidPoints) {
            console.log('📌 Нет валидных точек для совмещения');
            return false;
        }

        console.log('✅ Условия для автосовмещения выполнены!');
        return true;
    }

    // 🔥 6. СОХРАНИТЬ МОДЕЛЬ В БАЗУ ДАННЫХ (команда /save_model)
    async saveSessionAsModel(modelName = null, userId) {
        console.log(`\n💾 ===== СОХРАНЕНИЕ МОДЕЛИ =====`);
        console.log(`👤 Пользователь: ${userId}`);
        console.log(`📝 Имя модели: "${modelName || 'по умолчанию'}"`);

        if (!userId) {
            console.log('❌ Нет userId');
            return { success: false, error: 'No userId', code: 'NO_USER' };
        }

        if (!this.userSessions.has(userId)) {
            console.log(`❌ У ${userId} нет активной сессии`);
            return { success: false, error: 'Нет активной сессии', code: 'NO_SESSION' };
        }

        const userData = this.userSessions.get(userId);
        const model = userData.model;
        const session = userData.session;

        // ПРОВЕРКА МОДЕЛИ
        console.log(`🔍 Проверяю модель: "${model.name}"`);
        console.log(`   • Узлов: ${model.nodes.size}`);
        console.log(`   • Ребер: ${model.edges.length}`);
        console.log(`   • Оригинальных координат: ${model.originalCoordinates.size}`);
        console.log(`   • Фото в сессии: ${session.photos.length}`);

        if (model.nodes.size === 0) {
            console.log('❌ Модель пустая!');
            return {
                success: false,
                error: 'Модель пустая. Сначала добавьте фото следов.',
                code: 'EMPTY_MODEL',
                recommendations: [
                    'Отправьте хотя бы одно фото следа',
                    'Убедитесь что на фото есть протекторы обуви',
                    'Используйте лучшее освещение'
                ]
            };
        }

        if (model.nodes.size < 3) {
            console.log('⚠️ Мало узлов для качественной модели');
        }

        // ОБНОВЛЯЕМ ИМЯ МОДЕЛИ
        if (modelName && modelName.trim() !== '') {
            const oldName = model.name;
            model.name = modelName.trim();
            console.log(`📝 Изменил имя модели: "${oldName}" → "${model.name}"`);
        }

        // ОБНОВЛЯЕМ СТАТИСТИКУ ПЕРЕД СОХРАНЕНИЕМ
        model.stats.totalPhotos = session.photos.length;
        model.stats.totalAlignments = session.stats.successfulAlignments;
        model.stats.avgAlignmentScore = session.stats.avgAlignmentScore;
        model.stats.lastUpdated = new Date();

        // 🔥 СОХРАНЯЕМ В БАЗУ ДАННЫХ
        console.log(`💾 Сохраняю модель "${model.name}" в базу...`);
       
        try {
            const saveResult = this.database.saveFootprint(model);

            if (saveResult.success) {
                console.log(`✅ УСПЕХ! Модель сохранена в базу`);
                console.log(`🆔 ID модели: ${saveResult.id}`);
                console.log(`📁 Файл: ${saveResult.path}`);
               
                // Обновляем статистику пользователя
                userData.stats.modelsCreated = (userData.stats.modelsCreated || 0) + 1;
                userData.stats.lastSaved = new Date();

                // 🔥 ВОЗВРАЩАЕМ ПОЛНУЮ ИНФОРМАЦИЮ
                return {
                    success: true,
                    modelId: saveResult.id,
                    modelName: model.name,
                    sessionInfo: {
                        sessionId: session.id,
                        sessionName: session.name,
                        photosCount: session.photos.length,
                        startTime: session.startTime,
                        duration: Math.round((new Date() - session.startTime) / 1000)
                    },
                    modelStats: {
                        nodes: model.nodes.size,
                        edges: model.edges.length,
                        confidence: model.stats.confidence,
                        topologyQuality: model.stats.topologyQuality,
                        originalCoords: model.originalCoordinates.size,
                        alignmentHistory: model.alignmentHistory.length
                    },
                    alignmentStats: {
                        successful: session.stats.successfulAlignments,
                        total: session.stats.successfulAlignments + session.stats.failedAlignments,
                        avgScore: session.stats.avgAlignmentScore
                    },
                    recommendations: this.getSaveRecommendations(model, session)
                };

            } else {
                console.log('❌ Ошибка сохранения в базу:', saveResult.error);
                return {
                    success: false,
                    error: `Ошибка базы данных: ${saveResult.error}`,
                    code: 'DB_ERROR'
                };
            }

        } catch (error) {
            console.log('❌ Критическая ошибка при сохранении:', error.message);
            return {
                success: false,
                error: `Исключение: ${error.message}`,
                code: 'EXCEPTION'
            };
        }
    }

    // 🔥 7. РЕКОМЕНДАЦИИ ПОСЛЕ СОХРАНЕНИЯ
    getSaveRecommendations(model, session) {
        const recommendations = [];

        if (model.nodes.size < 5) {
            recommendations.push({
                type: 'nodes',
                priority: 'high',
                message: `Мало узлов (${model.nodes.size}). Добавьте больше фото для детальной модели.`,
                action: 'add_more_photos'
            });
        }

        if (model.stats.confidence < 0.6) {
            recommendations.push({
                type: 'confidence',
                priority: 'medium',
                message: `Низкая уверенность модели (${Math.round(model.stats.confidence * 100)}%).`,
                action: 'improve_photo_quality'
            });
        }

        if (session.photos.length === 1) {
            recommendations.push({
                type: 'photos',
                priority: 'high',
                message: 'Всего одно фото. Для лучшей модели добавьте 2-3 фото с разных ракурсов.',
                action: 'add_more_angles'
            });
        }

        if (model.originalCoordinates.size < model.nodes.size * 0.5) {
            recommendations.push({
                type: 'coordinates',
                priority: 'medium',
                message: 'Часть координат потеряна. Для совмещения нужны оригинальные координаты.',
                action: 'restart_with_better_photos'
            });
        }

        return recommendations;
    }

    // 🔥 8. ПОЛУЧИТЬ СЕССИЮ ПОЛЬЗОВАТЕЛЯ
    getSession(userId) {
        if (!this.userSessions.has(userId)) {
            return null;
        }
        return this.userSessions.get(userId).session;
    }

    // 🔥 9. ПОЛУЧИТЬ МОДЕЛЬ ПОЛЬЗОВАТЕЛЯ
    getModel(userId) {
        if (!this.userSessions.has(userId)) {
            return null;
        }
        return this.userSessions.get(userId).model;
    }

    // 🔥 10. ЗАВЕРШИТЬ СЕССИЮ
    endSession(userId) {
        if (!this.userSessions.has(userId)) {
            return null;
        }

        const userData = this.userSessions.get(userId);
        const session = userData.session;
        const model = userData.model;

        console.log(`\n🔚 ===== ЗАВЕРШЕНИЕ СЕССИИ =====`);
        console.log(`👤 Пользователь: ${userId}`);
        console.log(`📁 Сессия: ${session.name}`);
        console.log(`📊 Итоги:`);
        console.log(`   • Фото: ${session.photos.length}`);
        console.log(`   • Узлов в модели: ${model.nodes.size}`);
        console.log(`   • Успешных совмещений: ${session.stats.successfulAlignments}`);

        // УДАЛЯЕМ ИЗ ПАМЯТИ
        this.userSessions.delete(userId);

        return {
            sessionId: session.id,
            sessionName: session.name,
            photosCount: session.photos.length,
            modelName: model.name,
            modelNodes: model.nodes.size,
            successfulAlignments: session.stats.successfulAlignments,
            modelSaved: userData.stats.modelsCreated > 0
        };
    }

    // 🔥 11. ПОЛУЧИТЬ СТАТИСТИКУ
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
                analysesCount: session.analyses.length,
                stats: session.stats
            },
            model: {
                id: model.id,
                name: model.name,
                nodeCount: model.nodes.size,
                edgeCount: model.edges.length,
                confidence: model.stats.confidence,
                topologyQuality: model.stats.topologyQuality,
                originalCoordsCount: model.originalCoordinates.size,
                alignmentHistoryCount: model.alignmentHistory.length
            },
            userStats: userData.stats,
            alignmentConfig: this.alignmentConfig,
            recommendations: this.getSaveRecommendations(model, session)
        };
    }

    // 🔥 12. ВКЛЮЧИТЬ/ВЫКЛЮЧИТЬ АВТОСОВМЕЩЕНИЕ
    setAutoAlignment(enabled) {
        this.alignmentConfig.enabled = enabled;
        console.log(`🔧 Автосовмещение: ${enabled ? 'ВКЛЮЧЕНО ✅' : 'ВЫКЛЮЧЕНО ❌'}`);
        return this.alignmentConfig.enabled;
    }

    // 🔥 13. ПОЛУЧИТЬ ВСЕ АКТИВНЫЕ СЕССИИ
    getActiveSessions() {
        const sessions = [];
        for (const [userId, data] of this.userSessions) {
            sessions.push({
                userId: userId,
                sessionName: data.session.name,
                photosCount: data.session.photos.length,
                nodeCount: data.model.nodes.size,
                modelName: data.model.name,
                hasAutoAlignment: this.alignmentConfig.enabled
            });
        }
        return sessions;
    }

    // 🔥 14. ПОИСК ПОХОЖИХ МОДЕЛЕЙ
    async findSimilarModels(analysis, userId, options = {}) {
        console.log(`🔍 Поиск похожих моделей для пользователя ${userId}`);
       
        // 1. Получаем ВСЕ модели из базы
        const allModels = this.database.getAllModels();
        console.log(`📚 Всего моделей в базе: ${allModels.length}`);

        // 2. Фильтруем модели пользователя
        const userModels = allModels.filter(model =>
            model.userId === userId
        );

        console.log(`👤 Моделей пользователя: ${userModels.length}`);

        // 3. Создаем временную модель для сравнения
        const tempModel = new DigitalFootprint({
            name: 'Временная модель для сравнения',
            userId: userId
        });

        // 4. Добавляем анализ во временную модель
        tempModel.addAnalysis(analysis, {
            timestamp: new Date(),
            forComparison: true
        });

        if (tempModel.nodes.size < 3) {
            console.log('⚠️ Мало узлов для сравнения');
            return [];
        }

        // 5. Сравниваем с каждой моделью пользователя
        const results = [];
        for (const model of userModels) {
            try {
                // Простое сравнение по количеству узлов (можно улучшить)
                const nodeCountRatio = Math.min(model.nodes.size, tempModel.nodes.size) /
                                      Math.max(model.nodes.size, tempModel.nodes.size);
               
                if (nodeCountRatio > 0.5) { // Если разница не более 2x
                    results.push({
                        model: model,
                        score: nodeCountRatio,
                        similarity: nodeCountRatio > 0.8 ? 'высокая' :
                                   nodeCountRatio > 0.6 ? 'средняя' : 'низкая',
                        info: {
                            name: model.name,
                            nodes: model.nodes.size,
                            confidence: model.stats.confidence
                        }
                    });
                }
            } catch (error) {
                console.log(`⚠️ Ошибка сравнения с моделью ${model.name}:`, error.message);
            }
        }

        // Сортировка по score
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, options.limit || 5);
    }

    // 🔥 15. ДИАГНОСТИКА
    diagnose(userId) {
        if (!this.userSessions.has(userId)) {
            return { hasSession: false, message: 'Нет активной сессии' };
        }

        const userData = this.userSessions.get(userId);
        const session = userData.session;
        const model = userData.model;

        // Проверка координат
        const coordCheck = model.diagnoseCoordinates ? model.diagnoseCoordinates() : null;

        return {
            hasSession: true,
            session: {
                id: session.id,
                name: session.name,
                photos: session.photos.length,
                analyses: session.analyses.length
            },
            model: {
                name: model.name,
                nodes: model.nodes.size,
                edges: model.edges.length,
                originalCoords: model.originalCoordinates.size,
                confidence: model.stats.confidence
            },
            coordinates: coordCheck,
            alignment: {
                enabled: this.alignmentConfig.enabled,
                successful: session.stats.successfulAlignments,
                avgScore: session.stats.avgAlignmentScore
            },
            issues: this.detectIssues(model, session)
        };
    }

    // 🔥 16. ОБНАРУЖЕНИЕ ПРОБЛЕМ
    detectIssues(model, session) {
        const issues = [];

        if (model.originalCoordinates.size === 0) {
            issues.push({
                type: 'critical',
                message: 'Нет оригинальных координат! Автосовмещение не будет работать.',
                fix: 'Перезапустите сессию и отправьте фото заново'
            });
        }

        if (model.nodes.size > 0 && model.originalCoordinates.size < model.nodes.size) {
            issues.push({
                type: 'warning',
                message: `Не все узлы имеют оригинальные координаты (${model.originalCoordinates.size}/${model.nodes.size})`,
                fix: 'Добавьте больше фото'
            });
        }

        if (session.photos.length > 1 && session.stats.successfulAlignments === 0) {
            issues.push({
                type: 'warning',
                message: 'Нет успешных совмещений между фото',
                fix: 'Убедитесь что фото одного и того же следа'
            });
        }

        return issues;
    }

    // 🔥 17. ИНИЦИАЛИЗАЦИЯ (статический метод для main.js)
    static async initialize() {
        console.log('👣 Инициализация системы цифровых отпечатков...');
        // Можно добавить проверку базы данных, создание папок и т.д.
        return true;
    }
}

module.exports = FootprintManager;
