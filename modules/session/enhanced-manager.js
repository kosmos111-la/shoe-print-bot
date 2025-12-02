// modules/session/enhanced-manager.js
// Расширенный менеджер с аккумулятивными моделями

const { ImageNormalizer } = require('../analysis/normalizer.js');
const { FootprintModel } = require('./footprint-model.js');
const { SimilarityEngine } = require('../comparison/similarity-engine.js');

class EnhancedSessionManager {
  constructor() {
    this.models = new Map(); // sessionId -> FootprintModel
    this.userSessions = new Map(); // userId -> sessionId
    this.normalizer = new ImageNormalizer();
    this.similarityEngine = new SimilarityEngine();
    this.referenceCache = new Map(); // sessionId -> reference data
   
    console.log('🚀 EnhancedSessionManager инициализирован');
  }
 
  /**
   * Создание новой сессии с аккумулятивной моделью
   */
  createModelSession(userId, sessionName = '') {
    // Проверяем существующую сессию
    const existingSessionId = this.userSessions.get(userId);
    if (existingSessionId && this.models.has(existingSessionId)) {
      const existingModel = this.models.get(existingSessionId);
      return {
        sessionId: existingSessionId,
        model: existingModel,
        isExisting: true,
        message: `🔄 У вас уже есть активная модель\n\n` +
                 `🆔 ${existingSessionId.slice(0, 12)}...\n` +
                 `📊 Узлов: ${existingModel.getStats().totalNodes}\n` +
                 `📸 Фото: ${existingModel.photosProcessed}\n\n` +
                 `Продолжайте добавлять фото для уточнения.`
      };
    }
   
    // Создаём новую сессию
    const sessionId = `model_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const model = new FootprintModel(sessionId);
   
    this.models.set(sessionId, model);
    this.userSessions.set(userId, sessionId);
   
    return {
      sessionId,
      model,
      isExisting: false,
      message: `🎯 **АКТИВИРОВАН РЕЖИМ НАКОПЛЕНИЯ МОДЕЛИ**\n\n` +
               `🆔 ${sessionId.slice(0, 12)}...\n\n` +
               `📋 **Как работает:**\n` +
               `• Каждое фото уточняет модель следа\n` +
               `• Узлы накапливают уверенность\n` +
               `• Модель становится точнее с каждым фото\n\n` +
               `💡 **Для начала:**\n` +
               `1. Снимите общий план следа\n` +
               `2. Снимите детали протектора\n` +
               `3. Снимите под другим углом/освещением\n\n` +
               `📸 Отправьте первое фото для установки эталона`
    };
  }
 
  /**
   * Добавление фото в аккумулятивную модель
   */
  async addPhotoToModel(sessionId, photoData, rawPredictions) {
    const model = this.models.get(sessionId);
    if (!model) {
      throw new Error(`Модель ${sessionId} не найдена`);
    }
   
    console.log(`📸 Добавляю фото в модель ${sessionId}`);
   
    try {
      // Первое фото - устанавливаем референс
      if (model.photosProcessed === 0) {
        const referenceAnalysis = this.normalizer.analyzeForReference(rawPredictions);
        if (referenceAnalysis.canBeReference) {
          this.referenceCache.set(sessionId, {
            scale: referenceAnalysis.scale,
            orientation: referenceAnalysis.orientation,
            timestamp: new Date()
          });
          console.log(`📏 Референс установлен: ${referenceAnalysis.message}`);
        }
      }
     
      // Нормализуем предсказания
      const reference = this.referenceCache.get(sessionId);
      let normalizedPredictions = rawPredictions;
     
      if (reference) {
        normalizedPredictions = this.normalizer.normalizeToReference(
          rawPredictions,
          reference
        );
      }
     
      // Добавляем в модель
      const result = model.addPhotograph(
        normalizedPredictions,
        photoData.fileId || `photo_${Date.now()}`,
        {
          timestamp: new Date(),
          hasOutline: rawPredictions.some(p => p.class === 'Outline-trail'),
          protectorCount: rawPredictions.filter(p => p.class === 'shoe-protector').length
        }
      );
     
      // Формируем ответ
      const response = {
        success: true,
        sessionId,
        photoNumber: model.photosProcessed,
        ...result,
        summary: this.generatePhotoSummary(result, model.photosProcessed)
      };
     
      console.log(`✅ Фото добавлено в модель. Узлов: ${result.stats.totalNodes}`);
      return response;
     
    } catch (error) {
      console.log('❌ Ошибка добавления фото в модель:', error);
      throw error;
    }
  }
 
  /**
   * Быстрая проверка фрагмента
   */
  checkFragment(sessionId, fragmentPredictions) {
    const model = this.models.get(sessionId);
    if (!model) {
      return { error: `Модель ${sessionId} не найдена` };
    }
   
    try {
      const result = this.similarityEngine.compareFragmentWithModel(
        fragmentPredictions,
        model,
        { quickMode: true, allowMirroring: true }
      );
     
      const modelStats = model.getStats();
     
      return {
        ...result,
        modelInfo: {
          sessionId,
          nodeCount: modelStats.totalNodes,
          confidence: modelStats.modelConfidence,
          photosProcessed: modelStats.photosProcessed
        },
        recommendation: this.generateRecommendation(result, modelStats)
      };
     
    } catch (error) {
      console.log('❌ Ошибка проверки фрагмента:', error);
      return {
        isMatch: false,
        confidence: 0,
        error: error.message,
        message: '❌ Ошибка при проверке фрагмента'
      };
    }
  }
 
  /**
   * Получение статуса модели
   */
  getModelStatus(sessionId) {
    const model = this.models.get(sessionId);
    if (!model) {
      return { error: `Модель ${sessionId} не найдена` };
    }
   
    const stats = model.getStats();
    const consensus = model.getConsensusModel(0.6);
   
    return {
      sessionId,
      ...stats,
      highConfidenceNodes: consensus.nodes.length,
      modelAge: `${stats.ageMinutes} мин`,
      confidenceLevel: this.getConfidenceLevel(stats.modelConfidence),
      status: model.getModelStatus(),
      recommendations: model.getRecommendations(),
      canCompare: stats.highConfidenceNodes >= 5
    };
  }
 
  /**
   * Получение модели пользователя
   */
  getUserModel(userId) {
    const sessionId = this.userSessions.get(userId);
    if (!sessionId) return null;
   
    return this.models.get(sessionId);
  }
 
  /**
   * Экспорт модели
   */
  exportModel(sessionId, format = 'simple') {
    const model = this.models.get(sessionId);
    if (!model) return null;
   
    if (format === 'json') {
      return model.toJSON();
    } else {
      return model.getConsensusModel(0.5);
    }
  }
 
  /**
   * Очистка старых моделей
   */
  cleanupOldModels(maxAgeHours = 6) {
    const now = new Date();
    let cleaned = 0;
   
    for (const [sessionId, model] of this.models) {
      const ageHours = (now - model.creationTime) / (1000 * 60 * 60);
     
      if (ageHours > maxAgeHours) {
        // Удаляем из всех карт
        this.models.delete(sessionId);
        this.referenceCache.delete(sessionId);
       
        // Удаляем из userSessions
        for (const [userId, userSessionId] of this.userSessions) {
          if (userSessionId === sessionId) {
            this.userSessions.delete(userId);
            break;
          }
        }
       
        cleaned++;
        console.log(`🧹 Очищена старая модель: ${sessionId} (${ageHours.toFixed(1)} часов)`);
      }
    }
   
    return cleaned;
  }
 
  /**
   * Вспомогательные методы
   */
  generatePhotoSummary(result, photoNumber) {
    let summary = `✅ Фото ${photoNumber} добавлено\n\n`;
    summary += `📊 Статистика:\n`;
    summary += `• Новых узлов: ${result.added}\n`;
    summary += `• Обновлённых: ${result.updated}\n`;
    summary += `• Всего узлов: ${result.stats.totalNodes}\n`;
    summary += `• Уверенность модели: ${(result.stats.modelConfidence * 100).toFixed(1)}%\n\n`;
   
    if (photoNumber === 1) {
      summary += `🎯 Эталон установлен. Отправьте ещё фото для уточнения.`;
    } else if (result.stats.highConfidenceNodes >= 8) {
      summary += `✅ Модель хорошо детализирована. Можно сравнивать фрагменты.`;
    } else if (photoNumber < 3) {
      summary += `📸 Отправьте ещё ${3 - photoNumber} фото для повышения точности.`;
    } else {
      summary += `💡 Попробуйте снять под другим углом или с другим освещением.`;
    }
   
    return summary;
  }
 
  generateRecommendation(result, modelStats) {
    if (result.isMatch) {
      if (result.confidence > 0.85) {
        return `✅ Это ВАШ след с высокой уверенностью!`;
      } else if (result.confidence > 0.7) {
        return `✅ Это ваш след. Совпало ${result.matchCount} узлов.`;
      } else {
        return `✅ Возможно ваш след. Проверьте дополнительные детали.`;
      }
    } else {
      if (modelStats.highConfidenceNodes < 5) {
        return `⚠️  Мало данных в модели. Добавьте ещё фото.`;
      } else if (result.matchCount >= 2) {
        return `⚠️  Есть частичные совпадения. Возможно другой след той же обуви.`;
      } else {
        return `❌ Не похоже на ваш след. Совпадений: ${result.matchCount}`;
      }
    }
  }
 
  getConfidenceLevel(confidence) {
    if (confidence > 0.8) return 'ВЫСОКАЯ 🟢';
    if (confidence > 0.65) return 'СРЕДНЯЯ 🟡';
    if (confidence > 0.5) return 'НИЗКАЯ 🟠';
    return 'ОЧЕНЬ НИЗКАЯ 🔴';
  }
}

module.exports = { EnhancedSessionManager };
