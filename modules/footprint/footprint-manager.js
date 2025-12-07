// modules/footprint/footprint-manager.js - ОБНОВЛЁННАЯ ВЕРСИЯ
const DigitalFootprint = require('./digital-footprint');
const FootprintDatabase = require('./footprint-database');
const fs = require('fs');
const path = require('path');

class FootprintManager {
    constructor(options = {}) {
        this.database = new FootprintDatabase(options.dbPath);
        this.currentSession = null;
        this.currentModel = null;
      
        // 🔥 НАСТРОЙКИ ДЛЯ СОВМЕЩЕНИЯ
        this.alignmentConfig = {
            enabled: options.autoAlignment !== false,
            minPointsForAlignment: 4,
            minAlignmentScore: 0.6,
            requireConfirmation: options.requireConfirmation !== false
        };
      
        console.log('🔄 FootprintManager создан (с исправленными координатами)');
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

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Сохранить модель из сессии
    async saveSessionAsModel(session, modelName = null, userId) {
        // 🔥 ДОБАВЬ ПРОВЕРКУ СНАЧАЛА
        console.log('🔍 Проверяю данные сессии для сохранения...');
       
        if (!session || !session.analysisResults || session.analysisResults.length === 0) {
            console.log('❌ Нет данных для сохранения модели');
            return {
                success: false,
                error: 'Нет проанализированных данных в сессии',
                code: 'NO_DATA'
            };
        }
       
        // Проверяем каждое фото
        let totalPredictions = 0;
        session.analysisResults.forEach((result, idx) => {
            const predCount = result.predictions ? result.predictions.length : 0;
            totalPredictions += predCount;
            console.log(`📸 Фото ${idx + 1}: ${predCount} предсказаний`);
        });
       
        if (totalPredictions === 0) {
            console.log('❌ Нет предсказаний для создания модели');
            return {
                success: false,
                error: 'На фото не обнаружено следов',
                code: 'NO_PREDICTIONS'
            };
        }
       
        console.log(`✅ Данные для модели: ${session.analysisResults.length} фото, ${totalPredictions} предсказаний`);
       
        // Создаем новую модель DigitalFootprint
        const model = new DigitalFootprint({
            name: modelName || session.name || `Модель_${new Date().toLocaleDateString('ru-RU')}`,
            userId: userId,
            sessionId: session.id,
            metadata: {
                sessionInfo: {
                    sessionId: session.id,
                    sessionName: session.name,
                    photosCount: session.photos ? session.photos.length : 0,
                    analysesCount: session.analysisResults.length,
                    startTime: session.startTime,
                    endTime: new Date()
                }
            }
        });
       
        // Добавляем все анализы в модель
        let totalAdded = 0;
        let totalMerged = 0;
       
        for (const analysisResult of session.analysisResults) {
            try {
                const result = model.addAnalysis(analysisResult, {
                    sessionId: session.id,
                    timestamp: new Date()
                });
               
                totalAdded += result.added || 0;
                totalMerged += result.merged || 0;
               
            } catch (error) {
                console.log(`⚠️ Ошибка при добавлении анализа: ${error.message}`);
            }
        }
       
        console.log(`📊 Модель создана: ${model.nodes.size} узлов, ${model.edges.length} ребер`);
       
        // Проверяем, что модель содержит данные
        if (model.nodes.size === 0) {
            console.log('❌ Модель пустая после обработки всех анализов');
            return {
                success: false,
                error: 'Не удалось создать модель из предоставленных данных',
                code: 'EMPTY_MODEL'
            };
        }
       
        // Сохраняем в базу данных
        try {
            const saveResult = this.database.saveFootprint(model);
           
            if (saveResult.success) {
                console.log(`✅ Модель сохранена с ID: ${saveResult.id}`);
                console.log(`📊 Статистика модели:`);
                console.log(`   • Узлов: ${model.nodes.size}`);
                console.log(`   • Ребер: ${model.edges.length}`);
                console.log(`   • Оригинальных координат: ${model.originalCoordinates ? model.originalCoordinates.size : 0}`);
                console.log(`   • Качество топологии: ${(model.stats.topologyQuality * 100).toFixed(1)}%`);
               
                return {
                    success: true,
                    modelId: saveResult.id,
                    modelName: model.name,
                    stats: {
                        nodes: model.nodes.size,
                        edges: model.edges.length,
                        confidence: model.stats.confidence,
                        topologyQuality: model.stats.topologyQuality,
                        totalPhotos: session.analysisResults.length
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
            modelOriginalCoords: this.currentModel && this.currentModel.originalCoordinates ?
                this.currentModel.originalCoordinates.size : 0,
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
            totalAlignments: this.currentModel.alignmentHistory.length,
            successfulAlignments: this.currentModel.alignmentStats.successfulAlignments,
            avgScore: this.currentModel.alignmentStats.avgAlignmentScore,
            bestScore: this.currentModel.alignmentStats.bestAlignmentScore,
            originalCoordsCount: this.currentModel.originalCoordinates ?
                this.currentModel.originalCoordinates.size : 0,
            recentAlignments: this.currentModel.alignmentHistory.slice(-5).map(record => ({
                score: record.score,
                timestamp: record.timestamp,
                inliersCount: record.inliersCount,
                modelPointsCount: record.modelPointsCount,
                transformed: record.applied || false
            }))
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
            edges: this.currentModel.edges.length,
            confidence: this.currentModel.stats.confidence,
            topologyQuality: this.currentModel.stats.topologyQuality,
            originalCoords: this.currentModel.originalCoordinates ?
                this.currentModel.originalCoordinates.size : 0,
            alignmentStats: this.currentModel.getAlignmentStats ?
                this.currentModel.getAlignmentStats() : { totalAlignments: 0, successfulAlignments: 0 }
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
      
        if (quality.originalCoords > quality.nodes * 0.8) {
            overallScore += 0.1;
            factors += 0.1;
        }
      
        if (quality.alignmentStats.successfulAlignments > 0) {
            overallScore += 0.1;
            factors += 0.1;
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
        if (this.currentModel.stats.confidence < 0.7) {
            recommendations.push({
                type: 'confidence',
                priority: 'medium',
                message: `Уверенность модели низкая (${(this.currentModel.stats.confidence * 100).toFixed(1)}%). Снимайте с разных ракурсов.`,
                action: 'vary_angles'
            });
        }
      
        // Проверка оригинальных координат
        const originalCoordsCount = this.currentModel.originalCoordinates ?
            this.currentModel.originalCoordinates.size : 0;
        if (originalCoordsCount < this.currentModel.nodes.size * 0.5) {
            recommendations.push({
                type: 'coordinates',
                priority: 'high',
                message: `Мало оригинальных координат (${originalCoordsCount}/${this.currentModel.nodes.size}). Может нарушить совмещение.`,
                action: 'restart_session'
            });
        }
      
        // Проверка совмещений
        if (stats && stats.successfulAlignments < 2) {
            recommendations.push({
                type: 'alignment',
                priority: 'medium',
                message: 'Мало успешных совмещений. Убедитесь, что фото снимаются с одного следа.',
                action: 'check_footprint'
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
        console.log(`   • Оригинальных координат: ${this.currentModel && this.currentModel.originalCoordinates ?
            this.currentModel.originalCoordinates.size : 0}`);
      
        this.currentSession = null;
        this.currentModel = null;
    }

    loadModel(modelId) {
        const result = this.database.loadFootprint(modelId);
      
        if (result.success) {
            this.currentModel = result.footprint;
            console.log(`✅ Модель загружена: ${this.currentModel.name}`);
            console.log(`📍 Оригинальных координат: ${this.currentModel.originalCoordinates ?
                this.currentModel.originalCoordinates.size : 0}`);
          
            return {
                success: true,
                model: this.currentModel,
                stats: {
                    nodes: this.currentModel.nodes.size,
                    edges: this.currentModel.edges.length,
                    alignments: this.currentModel.alignmentHistory ? this.currentModel.alignmentHistory.length : 0,
                    originalCoords: this.currentModel.originalCoordinates ?
                        this.currentModel.originalCoordinates.size : 0
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
                edgeCount: this.currentModel.edges.length,
                confidence: this.currentModel.stats.confidence,
                originalCoordsCount: this.currentModel.originalCoordinates ?
                    this.currentModel.originalCoordinates.size : 0,
                alignmentHistoryCount: this.currentModel.alignmentHistory ?
                    this.currentModel.alignmentHistory.length : 0
            } : null,
            alignmentConfig: this.alignmentConfig,
            recommendations: this.getImprovementRecommendations()
        };
      
        return debugInfo;
    }

    // 🔥 НОВЫЙ МЕТОД: Диагностика координат модели
    diagnoseModelCoordinates() {
        if (!this.currentModel) {
            console.log('❌ Нет текущей модели для диагностики');
            return null;
        }
       
        return this.currentModel.diagnoseCoordinates();
    }
}

module.exports = FootprintManager;
