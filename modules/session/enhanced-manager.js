// modules/session/enhanced-manager.js
const { FootprintModel } = require('./footprint-model.js');
const { ImageNormalizer } = require('../analysis/normalizer.js');
const { SimilarityEngine } = require('../comparison/similarity-engine.js');

class EnhancedSessionManager {
  constructor() {
    this.models = new Map(); // sessionId -> FootprintModel
    this.normalizer = new ImageNormalizer();
    this.similarityEngine = new SimilarityEngine();
    this.referenceData = new Map(); // sessionId -> {scale, orientation}
  }
 
  // Создание новой сессии с аккумулятивной моделью
  createEnhancedSession(userId, sessionType = 'trail_analysis') {
    const sessionId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const model = new FootprintModel(sessionId);
   
    this.models.set(sessionId, model);
    console.log(`🆕 Создана enhanced сессия: ${sessionId}`);
   
    return {
      sessionId,
      model,
      message: `🎯 Активирован РЕЖИМ НАКОПЛЕНИЯ МОДЕЛИ\n\n` +
               `Каждое новое фото будет уточнять модель следа.\n` +
               `📊 Текущая модель: 0 узлов\n` +
               `📸 Отправьте первое фото для установки эталона`
    };
  }
 
  // Добавление фото в аккумулятивную модель
  async addPhotoToModel(sessionId, photoData, predictions) {
    const model = this.models.get(sessionId);
    if (!model) {
      throw new Error(`Сессия ${sessionId} не найдена`);
    }
   
    // Первое фото - устанавливаем референс
    if (model.photosProcessed === 0) {
      this.setReferenceData(sessionId, predictions);
    }
   
    // Нормализуем предсказания
    const reference = this.referenceData.get(sessionId);
    let normalizedPredictions = predictions;
   
    if (reference) {
      normalizedPredictions = this.normalizer.normalizeToReference(predictions, reference);
    }
   
    // Добавляем в модель
    const stats = model.addPhotograph(normalizedPredictions, photoData.fileId);
   
    // Обновляем референс если нужно
    if (model.photosProcessed === 1) {
      this.updateReferenceFromModel(sessionId, model);
    }
   
    return {
      success: true,
      stats,
      model: model.getConsensusModel(),
      photoNumber: model.photosProcessed,
      message: this.generatePhotoAddedMessage(stats, model.photosProcessed)
    };
  }
 
  // Быстрая проверка фрагмента
  checkFragment(sessionId, fragmentPredictions) {
    const model = this.models.get(sessionId);
    if (!model) {
      return { error: 'Модель не найдена' };
    }
   
    const result = this.similarityEngine.quickCheck(fragmentPredictions, model);
   
    return {
      ...result,
      modelStats: model.getStats(),
      recommendation: this.generateRecommendation(result, model)
    };
  }
 
  // Получение статуса модели
  getModelStatus(sessionId) {
    const model = this.models.get(sessionId);
    if (!model) {
      return { error: 'Модель не найдена' };
    }
   
    const stats = model.getStats();
    const consensus = model.getConsensusModel(0.7);
   
    return {
      sessionId,
      ...stats,
      highConfidenceNodes: consensus.nodes.length,
      modelAge: `${stats.ageMinutes.toFixed(1)} мин`,
      confidenceLevel: this.getConfidenceLevel(stats.modelConfidence),
      recommendations: this.generateModelRecommendations(stats)
    };
  }
 
  // Экспорт модели
  exportModel(sessionId, format = 'json') {
    const model = this.models.get(sessionId);
    if (!model) return null;
   
    if (format === 'json') {
      return model.toJSON();
    } else if (format === 'simple') {
      return model.getConsensusModel(0.6);
    }
  }
 
  // Вспомогательные методы
  setReferenceData(sessionId, predictions) {
    const scale = this.normalizer.calculateAverageDistance(predictions);
    const orientation = this.normalizer.calculateDominantOrientation(predictions);
   
    this.referenceData.set(sessionId, { scale, orientation });
    console.log(`📏 Референс для ${sessionId}: scale=${scale}, orientation=${orientation}°`);
  }
 
  updateReferenceFromModel(sessionId, model) {
    // Можно обновить референс на основе модели для лучшей точности
  }
 
  generatePhotoAddedMessage(stats, photoNumber) {
    let message = `✅ Фото ${photoNumber} добавлено в модель\n\n`;
    message += `📊 Узлов: ${stats.totalNodes} (+${stats.consensusNodes} подтверждённых)\n`;
    message += `🎯 Уверенность модели: ${(stats.modelConfidence * 100).toFixed(1)}%\n`;
   
    if (photoNumber === 1) {
      message += `\n🎯 Эталон установлен. Отправьте больше фото для уточнения модели.`;
    } else if (stats.highConfidenceNodes > 10) {
      message += `\n✅ Модель достаточно детализирована для сравнения.`;
    } else {
      message += `\n📸 Отправьте ещё фото для повышения точности.`;
    }
   
    return message;
  }
 
  generateRecommendation(result, model) {
    if (result.match) {
      return `✅ Это ВАШ след! Совпадает ${result.nodesMatched} узлов.`;
    } else if (model.getStats().totalNodes < 5) {
      return `⚠️  Мало данных в модели. Снимите ещё 2-3 фото следа.`;
    } else {
      return `❌ Не похоже на ваш след. Совпадений: ${result.nodesMatched}`;
    }
  }
 
  getConfidenceLevel(confidence) {
    if (confidence > 0.8) return 'ВЫСОКАЯ 🟢';
    if (confidence > 0.6) return 'СРЕДНЯЯ 🟡';
    if (confidence > 0.4) return 'НИЗКАЯ 🟠';
    return 'ОЧЕНЬ НИЗКАЯ 🔴';
  }
 
  generateModelRecommendations(stats) {
    const recs = [];
   
    if (stats.totalNodes < 5) {
      recs.push('• Нужно больше фото для построения модели');
    }
   
    if (stats.modelConfidence < 0.6) {
      recs.push('• Снимите те же участки под другим углом');
    }
   
    if (stats.highConfidenceNodes < 3) {
      recs.push('• Сфокусируйтесь на деталях протектора');
    }
   
    if (stats.photosProcessed >= 3 && stats.modelConfidence > 0.7) {
      recs.push('• Модель готова для сравнения в полевых условиях');
    }
   
    return recs.length > 0 ? recs : ['✅ Модель в хорошем состоянии'];
  }
 
  // Очистка старых моделей
  cleanupOldModels(maxAgeHours = 24) {
    const now = new Date();
    let cleaned = 0;
   
    for (const [sessionId, model] of this.models) {
      const ageHours = (now - model.creationTime) / (1000 * 60 * 60);
     
      if (ageHours > maxAgeHours) {
        this.models.delete(sessionId);
        this.referenceData.delete(sessionId);
        cleaned++;
        console.log(`🧹 Очищена старая модель: ${sessionId}`);
      }
    }
   
    return cleaned;
  }
}

module.exports = { EnhancedSessionManager };
