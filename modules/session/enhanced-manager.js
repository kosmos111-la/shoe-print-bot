// modules/session/enhanced-manager.js
// УПРОЩЕННАЯ РАБОЧАЯ ВЕРСИЯ

console.log('🚀 Загрузка EnhancedSessionManager...');

class EnhancedSessionManager {
  constructor() {
    console.log('✅ EnhancedSessionManager создан');
    this.models = new Map();
    this.userSessions = new Map();
    this.referenceCache = new Map();
   
    // 🔥 ЯВНО ОБЪЯВЛЯЕМ ВСЕ МЕТОДЫ
    this.createModelSession = this.createModelSession.bind(this);
    this.getUserModel = this.getUserModel.bind(this);
    this.getModelStatus = this.getModelStatus.bind(this);
    this.exportModel = this.exportModel.bind(this);
    this.addPhotoToModel = this.addPhotoToModel.bind(this);
    this.checkFragment = this.checkFragment.bind(this);
    this.cleanupOldModels = this.cleanupOldModels.bind(this);
  }

  // 🔥 ОСНОВНОЙ МЕТОД
  createModelSession(userId, sessionName = '') {
    console.log(`🎯 createModelSession вызван для ${userId}`);
   
    // Проверяем существующую сессию
    const existingSessionId = this.userSessions.get(userId);
    if (existingSessionId && this.models.has(existingSessionId)) {
      const existingModel = this.models.get(existingSessionId);
      return {
        sessionId: existingSessionId,
        model: existingModel,
        isExisting: true,
        message: `🔄 У вас уже есть активная модель\n\n` +
                 `🆔 ${existingSessionId.slice(0, 8)}...\n` +
                 `📸 Фото: ${existingModel.photosProcessed || 0}\n\n` +
                 `Продолжайте добавлять фото.`
      };
    }

    // Создаём новую сессию
    const sessionId = `model_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
   
    // Простая модель
    const model = {
      sessionId,
      photosProcessed: 0,
      nodes: [],
      contours: [],
      getStats: () => ({
        totalNodes: model.nodes.length,
        totalEdges: 0,
        totalContours: model.contours.length,
        modelConfidence: Math.min(0.5 + (model.photosProcessed * 0.1), 0.9),
        photosProcessed: model.photosProcessed,
        highConfidenceNodes: model.nodes.filter(n => n.confidence > 0.7).length
      }),
      getConsensusModel: () => ({
        nodes: model.nodes,
        edges: [],
        timestamp: new Date(),
        photosProcessed: model.photosProcessed,
        confidence: model.getStats().modelConfidence
      }),
      getFullModel: () => ({
        nodes: model.nodes,
        edges: [],
        contours: model.contours,
        specialPoints: {},
        photosProcessed: model.photosProcessed,
        confidence: model.getStats().modelConfidence,
        timestamp: new Date()
      })
    };

    this.models.set(sessionId, model);
    this.userSessions.set(userId, sessionId);

    console.log(`✅ Сессия создана: ${sessionId}`);

    return {
      sessionId,
      model,
      isExisting: false,
      message: `🎯 **АКТИВИРОВАН РЕЖИМ НАКОПЛЕНИЯ МОДЕЛИ**\n\n` +
               `🆔 ${sessionId.slice(0, 8)}...\n\n` +
               `📋 **Как работает:**\n` +
               `• Каждое фото уточняет модель\n` +
               `• Узлы накапливают уверенность\n` +
               `• Контуры сохраняются\n\n` +
               `💡 **Для начала:**\n` +
               `1. Снимите общий план\n` +
               `2. Снимите детали протектора\n` +
               `3. Снимите под другим углом\n\n` +
               `📸 Отправьте первое фото`
    };
  }

  // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ
  getUserModel(userId) {
    const sessionId = this.userSessions.get(userId);
    if (!sessionId) return null;
    return this.models.get(sessionId);
  }

  getModelStatus(sessionId) {
    const model = this.models.get(sessionId);
    if (!model) {
      return { error: `Модель ${sessionId} не найдена` };
    }

    const stats = model.getStats();

    return {
      sessionId,
      ...stats,
      modelAge: `${stats.photosProcessed > 0 ? 'Активна' : 'Новая'}`,
      confidenceLevel: stats.modelConfidence > 0.7 ? 'ВЫСОКАЯ 🟢' :
                      stats.modelConfidence > 0.5 ? 'СРЕДНЯЯ 🟡' : 'НИЗКАЯ 🟠',
      status: stats.photosProcessed === 0 ? '🆕 НОВАЯ' :
              stats.totalNodes > 5 ? '✅ ГОТОВА' : '📈 РАЗВИВАЕТСЯ',
      recommendations: stats.photosProcessed < 3 ?
        [`Отправьте ещё ${3 - stats.photosProcessed} фото`] :
        ['Модель развивается'],
      canCompare: stats.totalNodes >= 3,
      contourInfo: {
        total: stats.totalContours,
        hasOutline: model.contours.some(c => c.class === 'Outline-trail'),
        hasHeel: model.contours.some(c => c.class === 'Heel'),
        hasToe: model.contours.some(c => c.class === 'Toe')
      }
    };
  }

  exportModel(sessionId, format = 'simple') {
    const model = this.models.get(sessionId);
    if (!model) return null;

    if (format === 'full') {
      return model.getFullModel();
    } else {
      return model.getConsensusModel();
    }
  }

  async addPhotoToModel(sessionId, photoData, rawPredictions) {
    console.log(`📸 addPhotoToModel для ${sessionId}`);
   
    const model = this.models.get(sessionId);
    if (!model) {
      throw new Error(`Модель ${sessionId} не найдена`);
    }

    try {
      // Извлекаем узлы
      const protectors = rawPredictions.filter(p => p.class === 'shoe-protector');
      const newNodes = protectors.map(p => {
        const center = this.getCenter(p.points);
        return {
          id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          x: center.x,
          y: center.y,
          confidence: p.confidence || 0.5,
          occurrences: 1
        };
      });

      // Сохраняем контуры
      const newContours = rawPredictions
        .filter(p => p.points && p.points.length > 2)
        .map(p => ({
          class: p.class,
          points: p.points,
          confidence: p.confidence || 0.5,
          timestamp: new Date()
        }));

      // Обновляем модель
      model.nodes.push(...newNodes);
      model.contours.push(...newContours);
      model.photosProcessed++;

      console.log(`✅ Фото добавлено. Узлов: ${newNodes.length}, Контуров: ${newContours.length}`);

      return {
        success: true,
        sessionId,
        photoNumber: model.photosProcessed,
        added: newNodes.length,
        updated: 0,
        summary: `✅ Фото ${model.photosProcessed} добавлено\n\n` +
                `📊 Статистика:\n` +
                `• Новых узлов: ${newNodes.length}\n` +
                `• Новых контуров: ${newContours.length}\n` +
                `• Всего узлов: ${model.nodes.length}\n` +
                `• Всего контуров: ${model.contours.length}\n\n` +
                (model.photosProcessed === 1 ?
                  `🎯 Первое фото! Отправьте ещё для уточнения.` :
                  `💡 Модель уточняется.`)
      };

    } catch (error) {
      console.log('❌ Ошибка addPhotoToModel:', error);
      throw error;
    }
  }

  checkFragment(sessionId, fragmentPredictions) {
    console.log(`🔍 checkFragment для ${sessionId}`);
    return {
      isMatch: false,
      confidence: 0.3,
      matchCount: 0,
      message: 'Сравнение фрагментов временно недоступно',
      modelInfo: {
        sessionId,
        nodeCount: 0,
        confidence: 0,
        photosProcessed: 0
      },
      recommendation: 'Добавьте больше фото в модель'
    };
  }

  cleanupOldModels(maxAgeHours = 6) {
    console.log('🧹 cleanupOldModels вызван');
    let cleaned = 0;
    const now = Date.now();
   
    for (const [sessionId, model] of this.models) {
      // Простая очистка: если нет фото - удаляем
      if (model.photosProcessed === 0) {
        this.models.delete(sessionId);
        cleaned++;
      }
    }
   
    // Очищаем userSessions
    for (const [userId, sessionId] of this.userSessions) {
      if (!this.models.has(sessionId)) {
        this.userSessions.delete(userId);
      }
    }
   
    console.log(`🧹 Очищено ${cleaned} моделей`);
    return cleaned;
  }

  // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  getCenter(points) {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2
    };
  }
}

// 🔥 ЯВНЫЙ ЭКСПОРТ
module.exports = {
  EnhancedSessionManager
};

console.log('✅ EnhancedSessionManager загружен и готов к экспорту');
