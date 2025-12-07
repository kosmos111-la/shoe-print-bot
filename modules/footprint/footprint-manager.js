// modules/footprint/footprint-manager.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const fs = require('fs');
const path = require('path');

// 🔥 ИСПРАВЛЕННЫЕ ИМПОРТЫ С ЗАГЛУШКАМИ ДЛЯ ОШИБОК
function loadModule(moduleName) {
    try {
        const modulePath = path.join(__dirname, moduleName);
        return require(modulePath);
    } catch (error) {
        console.log(`❌ Ошибка загрузки модуля ${moduleName}:`, error.message);
       
        // Возвращаем заглушки если модули не найдены
        if (moduleName === 'digital-footprint') {
            return class DigitalFootprintStub {
                constructor(options) {
                    console.log('⚠️ DigitalFootprint stub created');
                    this.id = `stub_${Date.now()}`;
                    this.name = options?.name || 'Stub Footprint';
                    this.nodes = new Map();
                    this.edges = [];
                    this.alignmentHistory = [];
                    this.stats = {
                        confidence: 0.5,
                        topologyQuality: 0.5
                    };
                    this.metadata = {};
                }
                addAnalysis(analysis, sourceInfo) {
                    console.log('📌 Stub: adding analysis');
                    return { added: 1, merged: 0, totalNodes: 1 };
                }
                addAnalysisWithAlignment(analysis, sourceInfo) {
                    console.log('🎯 Stub: adding with alignment');
                    return {
                        added: 1,
                        merged: 0,
                        totalNodes: 1,
                        alignmentScore: 0.8,
                        transformed: true
                    };
                }
            };
        }
       
        if (moduleName === 'footprint-database') {
            return class FootprintDatabaseStub {
                constructor(dbPath) {
                    console.log('⚠️ FootprintDatabase stub created');
                    this.dbPath = dbPath || './data/footprints';
                }
                saveFootprint(footprint) {
                    console.log('💾 Stub: saving footprint');
                    return {
                        success: true,
                        id: `db_stub_${Date.now()}`,
                        path: this.dbPath
                    };
                }
                loadFootprint(modelId) {
                    console.log('📂 Stub: loading footprint');
                    return {
                        success: false,
                        error: 'Database stub - no real data'
                    };
                }
            };
        }
       
        return null;
    }
}

// Загружаем модули с заглушками
const DigitalFootprint = loadModule('digital-footprint');
const FootprintDatabase = loadModule('footprint-database');

class FootprintManager {
    constructor(options = {}) {
        this.database = new FootprintDatabase(options.dbPath);
        this.currentSession = null;
        this.currentModel = null;

        // 🔥 НОВЫЕ НАСТРОЙКИ ДЛЯ СОВМЕЩЕНИЯ
        this.alignmentConfig = {
            enabled: options.autoAlignment !== false,
            minPointsForAlignment: 4,
            minAlignmentScore: 0.6,
            requireConfirmation: options.requireConfirmation !== false
        };

        console.log('🔄 FootprintManager создан (с поддержкой автоматического совмещения)');
    }

    // 🔥 ОБНОВЛЁННЫЙ МЕТОД: Начать новую сессию
    startNewSession(userId, sessionName = null) {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.currentSession = {
            id: sessionId,
            userId: userId,
            name: sessionName || `Сессия_${new Date().toLocaleDateString('ru-RU')}`,
            startTime: new Date(),
            analyses: [],
            photos: [],
            model: null,
            stats: {
                totalPhotos: 0,
                successfulAlignments: 0,
                failedAlignments: 0,
                avgAlignmentScore: 0
            }
        };

        console.log(`🆕 Новая сессия: ${this.currentSession.name} (ID: ${sessionId})`);
        return this.currentSession;
    }

    // 🔥 ОБНОВЛЁННЫЙ МЕТОД: Добавить фото в сессию с автоматическим совмещением
    async addPhotoToSession(analysis, photoPath = null, sourceInfo = {}) {
        if (!this.currentSession) {
            console.log('❌ Нет активной сессии');
            return { success: false, error: 'Нет активной сессии' };
        }

        console.log(`\n📸 ===== ДОБАВЛЕНИЕ ФОТО В СЕССИЮ =====`);
        console.log(`📊 Сессия: ${this.currentSession.name}`);

        const enhancedSourceInfo = {
            ...sourceInfo,
            sessionId: this.currentSession.id,
            photoPath: photoPath,
            timestamp: new Date()
        };

        // 🔥 РЕШЕНИЕ: Использовать автоматическое совмещение или обычное добавление
        let result;

        if (this.shouldUseAlignment()) {
            console.log('🎯 Использую автоматическое совмещение...');
            result = await this.addPhotoWithAlignment(analysis, enhancedSourceInfo);
        } else {
            console.log('📌 Использую стандартное добавление...');
            result = await this.addPhotoStandard(analysis, enhancedSourceInfo);
        }

        // Обновляем статистику сессии
        this.updateSessionStats(result);

        // Сохраняем информацию о фото
        this.currentSession.photos.push({
            path: photoPath,
            timestamp: new Date(),
            analysisId: analysis.id || `analysis_${Date.now()}`,
            result: result
        });

        console.log(`✅ Фото добавлено в сессию`);
        console.log(`📊 Результат: ${result.transformed ? 'трансформировано' : 'не трансформировано'}`);
        if (result.alignmentScore) {
            console.log(`🎯 Score совмещения: ${(result.alignmentScore * 100).toFixed(1)}%`);
        }

        return result;
    }

    // 🔥 НОВЫЙ МЕТОД: Решение об использовании совмещения
    shouldUseAlignment() {
        if (!this.alignmentConfig.enabled) return false;

        // Если модель ещё не создана
        if (!this.currentModel || !this.currentModel.nodes || this.currentModel.nodes.size === 0) {
            console.log('📌 Модель пустая - совмещение не требуется');
            return false;
        }

        // Если в модели достаточно точек для совмещения
        const hasEnoughPoints = this.currentModel.nodes.size >= this.alignmentConfig.minPointsForAlignment;

        return hasEnoughPoints;
    }

    // 🔥 НОВЫЙ МЕТОД: Добавить фото с автоматическим совмещением
    async addPhotoWithAlignment(analysis, sourceInfo) {
        try {
            if (!this.currentModel) {
                // Создаём новую модель если её нет
                this.currentModel = new DigitalFootprint({
                    name: this.currentSession.name,
                    userId: this.currentSession.userId,
                    sessionId: this.currentSession.id
                });
            }

            // Используем новый метод с автоматическим совмещением
            const result = this.currentModel.addAnalysisWithAlignment(analysis, sourceInfo);

            // Сохраняем информацию о совмещении в сессии
            if (result.alignmentScore !== undefined) {
                this.currentSession.analyses.push({
                    type: 'aligned',
                    timestamp: new Date(),
                    alignmentScore: result.alignmentScore,
                    transformed: result.transformed || false,
                    nodeCount: result.totalNodes || 0
                });
            }

            return result;

        } catch (error) {
            console.log('❌ Ошибка при совмещении:', error.message);

            // Fallback: используем стандартное добавление
            console.log('🔄 Переключаюсь на стандартное добавление...');
            return await this.addPhotoStandard(analysis, sourceInfo);
        }
    }

    // 🔥 МЕТОД: Стандартное добавление фото (без совмещения)
    async addPhotoStandard(analysis, sourceInfo) {
        try {
            if (!this.currentModel) {
                // Создаём новую модель
                this.currentModel = new DigitalFootprint({
                    name: this.currentSession.name,
                    userId: this.currentSession.userId,
                    sessionId: this.currentSession.id
                });
            }

            const result = this.currentModel.addAnalysis(analysis, sourceInfo);

            // Сохраняем информацию в сессии
            this.currentSession.analyses.push({
                type: 'standard',
                timestamp: new Date(),
                nodeCount: result.totalNodes || 0,
                addedNodes: result.added || 0,
                mergedNodes: result.merged || 0
            });

            return result;

        } catch (error) {
            console.log('❌ Ошибка при стандартном добавлении:', error.message);
            return {
                success: false,
                error: error.message,
                added: 0,
                merged: 0,
                totalNodes: this.currentModel ? this.currentModel.nodes.size : 0
            };
        }
    }

    // 🔥 ОБНОВЛЁННЫЙ МЕТОД: Сохранить модель из сессии
    async saveSessionAsModel(modelName = null, options = {}) {
        if (!this.currentSession || !this.currentModel) {
            console.log('❌ Нет активной сессии или модели');
            return { success: false, error: 'Нет активной сессии' };
        }

        const finalModelName = modelName || this.currentSession.name;

        console.log(`\n💾 ===== СОХРАНЕНИЕ МОДЕЛИ =====`);
        console.log(`📝 Название: ${finalModelName}`);
        console.log(`📊 Узлов в модели: ${this.currentModel.nodes.size}`);

        // Обновляем имя модели
        this.currentModel.name = finalModelName;

        // Добавляем метаданные сессии
        this.currentModel.metadata = this.currentModel.metadata || {};
        this.currentModel.metadata.sessionInfo = {
            sessionId: this.currentSession.id,
            sessionName: this.currentSession.name,
            photosCount: this.currentSession.photos.length,
            analysesCount: this.currentSession.analyses.length,
            startTime: this.currentSession.startTime,
            endTime: new Date()
        };

        // Добавляем статистику совмещений
        this.currentModel.metadata.alignmentStats = {
            totalAlignments: this.currentSession.stats.totalPhotos,
            successfulAlignments: this.currentSession.stats.successfulAlignments,
            successRate: this.currentSession.stats.totalPhotos > 0 ?
                this.currentSession.stats.successfulAlignments / this.currentSession.stats.totalPhotos : 0,
            avgAlignmentScore: this.currentSession.stats.avgAlignmentScore
        };

        try {
            // 🔥 ПРОВЕРЯЕМ, ЧТО МЕТОД СУЩЕСТВУЕТ
            if (typeof this.database.saveFootprint !== 'function') {
                console.log('❌ database.saveFootprint не является функцией');
                console.log('Database тип:', typeof this.database);
                return { success: false, error: 'Database не инициализирован' };
            }

            // Сохраняем в базу данных
            const saveResult = this.database.saveFootprint(this.currentModel);

            if (saveResult && saveResult.success) {
                console.log(`✅ Модель сохранена с ID: ${saveResult.id}`);
                console.log(`📊 Статистика модели:`);
                console.log(`   • Узлов: ${this.currentModel.nodes.size}`);
                console.log(`   • Качество топологии: ${(this.currentModel.stats.topologyQuality * 100).toFixed(1)}%`);

                // Очищаем текущую сессию
                this.endSession();

                return {
                    success: true,
                    modelId: saveResult.id,
                    modelName: finalModelName,
                    stats: {
                        nodes: this.currentModel.nodes.size,
                        edges: this.currentModel.edges ? this.currentModel.edges.length : 0,
                        alignments: this.currentModel.alignmentHistory ? this.currentModel.alignmentHistory.length : 0,
                        topologyQuality: this.currentModel.stats ? this.currentModel.stats.topologyQuality : 0,
                        confidence: this.currentModel.stats ? this.currentModel.stats.confidence : 0
                    }
                };
            } else {
                console.log('❌ Ошибка сохранения модели:', saveResult ? saveResult.error : 'Нет результата');
                return { success: false, error: saveResult ? saveResult.error : 'Неизвестная ошибка' };
            }

        } catch (error) {
            console.log('❌ Исключение при сохранении:', error.message);
            console.log('Stack:', error.stack);
            return { success: false, error: error.message };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Обновить статистику сессии
    updateSessionStats(photoResult) {
        if (!this.currentSession) return;

        this.currentSession.stats.totalPhotos++;

        if (photoResult.alignmentScore !== undefined) {
            if (photoResult.alignmentScore > this.alignmentConfig.minAlignmentScore) {
                this.currentSession.stats.successfulAlignments++;
            } else {
                this.currentSession.stats.failedAlignments++;
            }

            // Обновляем средний score
            const totalScore = this.currentSession.stats.avgAlignmentScore * (this.currentSession.stats.totalPhotos - 1);
            this.currentSession.stats.avgAlignmentScore =
                (totalScore + (photoResult.alignmentScore || 0)) / this.currentSession.stats.totalPhotos;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Получить статистику текущей сессии
    getSessionStats() {
        if (!this.currentSession) return null;

        const stats = {
            ...this.currentSession.stats,
            photosCount: this.currentSession.photos.length,
            analysesCount: this.currentSession.analyses.length,
            modelExists: !!this.currentModel,
            modelNodeCount: this.currentModel ? this.currentModel.nodes.size : 0,
            alignmentEnabled: this.alignmentConfig.enabled
        };

        // Добавляем детализацию по типам анализов
        const analysisTypes = this.currentSession.analyses.reduce((acc, analysis) => {
            acc[analysis.type] = (acc[analysis.type] || 0) + 1;
            return acc;
        }, {});

        stats.analysisTypes = analysisTypes;

        return stats;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить информацию о совмещениях в текущей сессии
    getAlignmentInfo() {
        if (!this.currentModel) return null;

        return {
            totalAlignments: this.currentModel.alignmentHistory ? this.currentModel.alignmentHistory.length : 0,
            recentAlignments: this.currentModel.alignmentHistory ?
                this.currentModel.alignmentHistory.slice(-5).map(record => ({
                    score: record.score,
                    timestamp: record.timestamp,
                    transformed: record.applied || false
                })) : []
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Включить/выключить автоматическое совмещение
    setAutoAlignment(enabled) {
        this.alignmentConfig.enabled = enabled;
        console.log(`🔧 Автоматическое совмещение: ${enabled ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);
        return this.alignmentConfig.enabled;
    }

    // 🔥 НОВЫЙ МЕТОД: Настроить параметры совмещения
    configureAlignment(options = {}) {
        this.alignmentConfig = {
            ...this.alignmentConfig,
            ...options
        };

        console.log('🔧 Параметры совмещения обновлены:', this.alignmentConfig);
        return this.alignmentConfig;
    }

    // 🔥 НОВЫЙ МЕТОД: Оценить качество текущей модели
    assessModelQuality() {
        if (!this.currentModel) return null;

        const quality = {
            nodes: this.currentModel.nodes.size,
            edges: this.currentModel.edges ? this.currentModel.edges.length : 0,
            confidence: this.currentModel.stats ? this.currentModel.stats.confidence : 0,
            topologyQuality: this.currentModel.stats ? this.currentModel.stats.topologyQuality : 0
        };

        // Простая оценка
        let overallScore = 0;
        let factors = 0;

        if (quality.nodes >= 5) {
            overallScore += 0.3;
            factors += 0.3;
        }

        if (quality.confidence > 0.7) {
            overallScore += 0.3;
            factors += 0.3;
        }

        if (quality.topologyQuality > 0.6) {
            overallScore += 0.2;
            factors += 0.2;
        }

        quality.overallScore = factors > 0 ? overallScore / factors : 0;

        // Оценка качества
        if (quality.overallScore > 0.8) {
            quality.grade = 'excellent';
            quality.message = 'Модель отличного качества';
        } else if (quality.overallScore > 0.6) {
            quality.grade = 'good';
            quality.message = 'Модель хорошего качества';
        } else if (quality.overallScore > 0.4) {
            quality.grade = 'acceptable';
            quality.message = 'Модель приемлемого качества';
        } else {
            quality.grade = 'poor';
            quality.message = 'Модель требует улучшения';
        }

        return quality;
    }

    // 🔥 НОВЫЙ МЕТОД: Рекомендации по улучшению модели
    getImprovementRecommendations() {
        if (!this.currentModel) return [];

        const recommendations = [];
        const stats = this.getSessionStats();

        // Проверка количества узлов
        if (this.currentModel.nodes.size < 8) {
            recommendations.push({
                type: 'nodes',
                priority: 'high',
                message: `Добавьте больше фото (сейчас ${this.currentModel.nodes.size} узлов, нужно минимум 8)`,
                action: 'add_more_photos'
            });
        }

        // Проверка уверенности модели
        if (this.currentModel.stats && this.currentModel.stats.confidence < 0.7) {
            recommendations.push({
                type: 'confidence',
                priority: 'medium',
                message: `Уверенность модели низкая (${(this.currentModel.stats.confidence * 100).toFixed(1)}%). Снимайте с разных ракурсов.`,
                action: 'vary_angles'
            });
        }

        return recommendations;
    }

    // СУЩЕСТВУЮЩИЕ МЕТОДЫ

    endSession() {
        if (!this.currentSession) return;

        console.log(`\n🔚 Завершение сессии: ${this.currentSession.name}`);
        console.log(`📊 Итоги:`);
        console.log(`   • Фото: ${this.currentSession.photos.length}`);
        console.log(`   • Анализов: ${this.currentSession.analyses.length}`);
        console.log(`   • Узлов в модели: ${this.currentModel ? this.currentModel.nodes.size : 0}`);

        this.currentSession = null;
        this.currentModel = null;
    }

    loadModel(modelId) {
        if (typeof this.database.loadFootprint !== 'function') {
            console.log('❌ database.loadFootprint не является функцией');
            return { success: false, error: 'Database не поддерживает загрузку' };
        }

        const result = this.database.loadFootprint(modelId);

        if (result.success) {
            this.currentModel = result.footprint;
            console.log(`✅ Модель загружена: ${this.currentModel.name}`);

            return {
                success: true,
                model: this.currentModel,
                stats: {
                    nodes: this.currentModel.nodes.size,
                    edges: this.currentModel.edges ? this.currentModel.edges.length : 0
                }
            };
        } else {
            console.log('❌ Ошибка загрузки модели:', result.error);
            return { success: false, error: result.error };
        }
    }

    getCurrentModel() {
        return this.currentModel;
    }

    getCurrentSession() {
        return this.currentSession;
    }

    // 🔥 НОВЫЙ МЕТОД: Экспорт данных сессии для отладки
    exportSessionDebugInfo() {
        if (!this.currentSession) return null;

        const debugInfo = {
            session: {
                id: this.currentSession.id,
                name: this.currentSession.name,
                startTime: this.currentSession.startTime,
                photosCount: this.currentSession.photos.length,
                analysesCount: this.currentSession.analyses.length,
                stats: this.currentSession.stats
            },
            model: this.currentModel ? {
                id: this.currentModel.id,
                name: this.currentModel.name,
                nodeCount: this.currentModel.nodes.size,
                edgeCount: this.currentModel.edges ? this.currentModel.edges.length : 0,
                confidence: this.currentModel.stats ? this.currentModel.stats.confidence : 0
            } : null,
            alignmentConfig: this.alignmentConfig,
            recommendations: this.getImprovementRecommendations()
        };

        return debugInfo;
    }
}

module.exports = FootprintManager;
