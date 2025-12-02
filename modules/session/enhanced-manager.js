// modules/session/enhanced-manager.js
// Расширенный менеджер с аккумулятивными моделями и контурами

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

  // ... существующие методы createModelSession, addPhotoToModel, checkFragment ...

  /**
   * Экспорт модели
   */
  exportModel(sessionId, format = 'simple') {
    const model = this.models.get(sessionId);
    if (!model) return null;

    if (format === 'json') {
      return model.toJSON();
    } else if (format === 'full') {
      // 🆕 ПОЛНЫЙ ЭКСПОРТ С КОНТУРАМИ
      return model.getFullModel(0.5);
    } else {
      // Простой формат (по умолчанию)
      return model.getConsensusModel(0.5);
    }
  }

  /**
   * Получение статуса модели (обновленный с информацией о контурах)
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
      canCompare: stats.highConfidenceNodes >= 5 && stats.totalContours >= 3,
      contourInfo: {
        total: stats.totalContours,
        hasOutline: model.getContoursForVisualization(0.3).some(c => c.class === 'Outline-trail'),
        hasHeel: model.getSpecialPoints().heel !== undefined,
        hasToe: model.getSpecialPoints().toe !== undefined
      }
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

  // ... остальные существующие методы (generatePhotoSummary, getConfidenceLevel и т.д.) ...

  generatePhotoSummary(result, photoNumber) {
    let summary = `✅ Фото ${photoNumber} добавлено\n\n`;
    summary += `📊 Статистика:\n`;
    summary += `• Новых узлов: ${result.added}\n`;
    summary += `• Обновлённых: ${result.updated}\n`;
    summary += `• Новых контуров: ${result.contours?.added || 0}\n`;
    summary += `• Всего узлов: ${result.stats.totalNodes}\n`;
    summary += `• Всего контуров: ${result.stats.totalContours}\n`;
    summary += `• Уверенность модели: ${(result.stats.modelConfidence * 100).toFixed(1)}%\n\n`;

    if (photoNumber === 1) {
      summary += `🎯 Эталон установлен. Контуры сохранены. Отправьте ещё фото для уточнения.`;
    } else if (result.stats.highConfidenceNodes >= 8 && result.stats.totalContours >= 5) {
      summary += `✅ Модель хорошо детализирована. Контуры сохранены. Можно сравнивать фрагменты.`;
    } else if (photoNumber < 3) {
      summary += `📸 Отправьте ещё ${3 - photoNumber} фото для повышения точности и сохранения контуров.`;
    } else if (result.stats.totalContours < 3) {
      summary += `🎨 Мало контуров. Убедитесь, что контуры отрисовываются на фото.`;
    } else {
      summary += `💡 Попробуйте снять под другим углом или с другим освещением для лучших контуров.`;
    }

    return summary;
  }

  generateRecommendation(result, modelStats) {
    if (result.isMatch) {
      if (result.confidence > 0.85) {
        return `✅ Это ВАШ след с высокой уверенностью! Контуры совпадают.`;
      } else if (result.confidence > 0.7) {
        return `✅ Это ваш след. Совпало ${result.matchCount} узлов. Контуры соответствуют.`;
      } else {
        return `✅ Возможно ваш след. Проверьте дополнительные детали и контуры.`;
      }
    } else {
      if (modelStats.highConfidenceNodes < 5 || modelStats.totalContours < 3) {
        return `⚠️  Мало данных в модели (узлов: ${modelStats.highConfidenceNodes}, контуров: ${modelStats.totalContours}). Добавьте ещё фото.`;
      } else if (result.matchCount >= 2) {
        return `⚠️  Есть частичные совпадения узлов. Контуры могут не совпадать.`;
      } else {
        return `❌ Не похоже на ваш след. Узлов: ${result.matchCount}, контуры отличаются.`;
      }
    }
  }

  getConfidenceLevel(confidence) {
    if (confidence > 0.8) return 'ВЫСОКАЯ 🟢';
    if (confidence > 0.65) return 'СРЕДНЯЯ 🟡';
    if (confidence > 0.5) return 'НИЗКАЯ 🟠';
    return 'ОЧЕНЬ НИЗКАЯ 🔴';
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
        console.log(`🧹 Очищена старая модель: ${sessionId} (${ageHours.toFixed(1)} часов, контуров: ${model.contours.size})`);
      }
    }

    return cleaned;
  }
}

module.exports = { EnhancedSessionManager };
