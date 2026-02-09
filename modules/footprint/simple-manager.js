// modules/footprint/simple-manager.js
// 🔥 УПРОЩЕННЫЙ МЕНЕДЖЕР С АККУМУЛЯЦИОННОЙ МОДЕЛЬЮ

const fs = require('fs');
const path = require('path');
const SimpleGraph = require('./simple-graph');

class SimpleFootprintManager {
  constructor(options = {}) {
    console.log('🚀 SimpleFootprintManager создан с АККУМУЛЯЦИОННОЙ МОДЕЛЬЮ');
   
    // 🔥 ПРОСТЫЕ НАСТРОЙКИ
    this.config = {
      dbPath: options.dbPath || './data/footprints',
      autoSave: options.autoSave !== false,
      debug: options.debug || false,
      minPointsForFootprint: options.minPointsForFootprint || 5,
      similarityThreshold: 0.6, // 60% для решения "одна обувь"
      ...options
    };
   
    // 🔥 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ (без трансформаций)
    this.geometricAlgorithm = require('./clean/vector-algorithm');
   
    // 🔥 ВИЗУАЛИЗАЦИЯ
    try {
      const ClusterVisualizer = require('./visualizations/cluster-visualizer');
      this.visualizer = new ClusterVisualizer({
        outputDir: path.join(this.config.dbPath, 'visualizations', 'accumulative'),
        debug: this.config.debug
      });
      console.log('✅ Визуализатор инициализирован');
    } catch (error) {
      console.log('⚠️ Визуализатор не доступен:', error.message);
      this.visualizer = null;
    }
   
    // 🔥 СТРУКТУРЫ ДАННЫХ
    this.userFootprints = new Map(); // userId -> SimpleFootprint
    this.systemStats = {
      totalUsers: 0,
      totalFootprints: 0,
      totalPhotosProcessed: 0,
      algorithm: 'geometric_accumulative_v1.0'
    };
   
    this.ensureDirectories();
    this.loadExistingFootprints();
   
    console.log('✅ SimpleFootprintManager инициализирован с аккумуляционной моделью');
  }
 
  // 🔥 ГЛАВНЫЙ МЕТОД: Добавить фото
  async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
    console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО для пользователя ${userId} (аккумуляционная модель)`);
   
    try {
      if (!analysis?.predictions) {
        return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
      }
     
      // Извлекаем точки
      const points = this.extractPointsFromAnalysis(analysis);
      if (points.length < this.config.minPointsForFootprint) {
        return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
      }
     
      console.log(`📊 Извлечено ${points.length} точек`);
     
      // Получаем или создаем отпечаток пользователя
      let footprint = this.userFootprints.get(userId);
      let isNewFootprint = false;
     
      if (!footprint) {
        console.log(`👣 Создаю новый аккумуляционный отпечаток для пользователя ${userId}`);
        const SimpleFootprint = require('./simple-footprint');
        footprint = new SimpleFootprint({
          userId: userId,
          name: `Аккумуляционный_${new Date().toLocaleDateString('ru-RU')}`,
          debug: this.config.debug
        });
       
        this.userFootprints.set(userId, footprint);
        this.systemStats.totalUsers++;
        isNewFootprint = true;
      }
     
      // Добавляем анализ в отпечаток
      const addResult = footprint.addAnalysis(analysis, {
        ...photoInfo,
        photoId: photoInfo.photoId || `photo_${Date.now()}`,
        source: photoInfo.source || 'telegram_bot'
      });
     
      // 🔥 СРАВНЕНИЕ С ПРЕДЫДУЩИМИ ФОТО (если это не первое фото)
      let comparisonResult = null;
      let similarity = 0;
     
      if (!isNewFootprint && footprint.metadata.totalPhotos > 1) {
        // Простое сравнение по статистике подтверждений
        const stats = footprint.pointTracker.getStats();
        similarity = Math.min(1, stats.avgConfirmations * 0.5);
       
        comparisonResult = {
          similar: similarity > this.config.similarityThreshold,
          similarity: similarity,
          decision: similarity > this.config.similarityThreshold ? 'same' : 'different',
          reason: `Среднее подтверждений: ${stats.avgConfirmations.toFixed(2)}`
        };
      }
     
      // 🔥 ВИЗУАЛИЗАЦИЯ
      let visualizationResult = null;
      if (this.visualizer) {
        try {
          visualizationResult = await this.visualizer.visualizeAccumulativeFootprint(footprint, {
            filename: `accumulative_${userId}_${Date.now()}.png`
          });
        } catch (vizError) {
          console.log('⚠️ Ошибка визуализации:', vizError.message);
        }
      }
     
      // 🔥 TELEGRAM ОТПРАВКА (если нужно)
      if (bot && chatId && visualizationResult?.path) {
        await this.sendToTelegram(bot, chatId, footprint, addResult, comparisonResult, visualizationResult);
      }
     
      // 🔥 СОХРАНЕНИЕ
      if (this.config.autoSave) {
        this.saveFootprint(userId);
      }
     
      // ОБНОВЛЕНИЕ СТАТИСТИКИ
      this.systemStats.totalPhotosProcessed++;
      this.systemStats.totalFootprints = this.userFootprints.size;
     
      console.log(`📊 ИТОГОВЫЙ РЕЗУЛЬТАТ:`);
      console.log(`   Уникальных точек: ${footprint.pointTracker.points.size}`);
      console.log(`   Статистика: ${JSON.stringify(footprint.pointTracker.getStats())}`);
     
      return {
        success: true,
        isNewFootprint: isNewFootprint,
        nodesAdded: addResult.added || 0,
        totalNodes: footprint.graph.nodes.size,
        similarity: similarity,
        decision: comparisonResult?.decision || 'first_photo',
        visualization: visualizationResult,
        footprintId: footprint.id,
        stats: footprint.pointTracker.getStats()
      };
     
    } catch (error) {
      console.error(`❌ Ошибка в addPhotoToSession: ${error.message}`);
      return { success: false, error: error.message, nodesAdded: 0 };
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
          _source: 'analysis'
        });
      }
    }
   
    return points.filter(p =>
      p && typeof p.x === 'number' && typeof p.y === 'number' &&
      !isNaN(p.x) && !isNaN(p.y)
    );
  }
 
  // 🔥 TELEGRAM ОТПРАВКА
  async sendToTelegram(bot, chatId, footprint, addResult, comparisonResult, visualizationResult) {
    console.log(`🤖 Отправляю в Telegram...`);
   
    if (!visualizationResult?.path || !fs.existsSync(visualizationResult.path)) {
      console.log('⚠️ Нет файла визуализации для отправки');
      return;
    }
   
    try {
      const cleanMarkdown = (text) => text
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/__/g, '')
        .replace(/_/g, '')
        .replace(/`/g, '');
     
      const stats = footprint.pointTracker.getStats();
     
      let caption = `👣 АККУМУЛЯЦИОННАЯ МОДЕЛЬ\n\n`;
      caption += `📊 Уникальных точек: ${stats.totalPoints}\n`;
      caption += `🔴 3+ подтверждений: ${stats.confirmed3}\n`;
      caption += `🟠 2 подтверждения: ${stats.confirmed2}\n`;
      caption += `🔵 1 подтверждение: ${stats.confirmed1}\n`;
      caption += `🎯 Среднее: ${stats.avgConfirmations.toFixed(2)}\n`;
     
      if (comparisonResult) {
        caption += `\n🎯 Сравнение: ${(comparisonResult.similarity * 100).toFixed(1)}%\n`;
        caption += `Решение: ${comparisonResult.decision === 'same' ? '✅ ОДНА ОБУВЬ' : '⚠️ ПРОВЕРИТЬ'}\n`;
      }
     
      caption += `\nАлгоритм: 🎯 Геометрическая аккумуляция`;
     
      await bot.sendPhoto(chatId, visualizationResult.path, {
        caption: cleanMarkdown(caption),
        parse_mode: 'HTML'
      });
     
      console.log('✅ Визуализация отправлена в Telegram');
    } catch (error) {
      console.log('❌ Ошибка отправки в Telegram:', error.message);
    }
  }
 
  // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  ensureDirectories() {
    const dirs = [
      this.config.dbPath,
      path.join(this.config.dbPath, 'footprints'),
      path.join(this.config.dbPath, 'visualizations'),
      path.join(this.config.dbPath, 'visualizations', 'accumulative')
    ];
   
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
 
  loadExistingFootprints() {
    const footprintsDir = path.join(this.config.dbPath, 'footprints');
    if (!fs.existsSync(footprintsDir)) return;
   
    const files = fs.readdirSync(footprintsDir).filter(f => f.endsWith('.json'));
    let loadedCount = 0;
   
    files.slice(0, 50).forEach(file => {
      try {
        const filePath = path.join(footprintsDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
       
        const SimpleFootprint = require('./simple-footprint');
        const footprint = SimpleFootprint.fromJSON(data);
       
        if (footprint.userId) {
          this.userFootprints.set(footprint.userId, footprint);
          loadedCount++;
        }
      } catch (error) {
        console.log(`⚠️ Ошибка загрузки отпечатка ${file}:`, error.message);
      }
    });
   
    console.log(`📂 Загружено ${loadedCount} отпечатков`);
  }
 
  saveFootprint(userId) {
    const footprint = this.userFootprints.get(userId);
    if (!footprint) return;
   
    try {
      const footprintsDir = path.join(this.config.dbPath, 'footprints');
      if (!fs.existsSync(footprintsDir)) {
        fs.mkdirSync(footprintsDir, { recursive: true });
      }
     
      const filename = `accumulative_${userId}_${footprint.id}.json`;
      const filePath = path.join(footprintsDir, filename);
     
      const data = footprint.toJSON();
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
     
      console.log(`💾 Отпечаток сохранен: ${filename}`);
    } catch (error) {
      console.log(`❌ Ошибка сохранения отпечатка:`, error.message);
    }
  }
 
  // 🔥 СИСТЕМНАЯ СТАТИСТИКА
  getSystemStats() {
    const userStats = [];
   
    for (const [userId, footprint] of this.userFootprints) {
      const stats = footprint.pointTracker.getStats();
      userStats.push({
        userId: userId,
        footprintId: footprint.id,
        totalPoints: stats.totalPoints,
        avgConfirmations: stats.avgConfirmations.toFixed(2),
        totalPhotos: footprint.metadata.totalPhotos
      });
    }
   
    return {
      ...this.systemStats,
      activeUsers: this.userFootprints.size,
      userStats: userStats
    };
  }
 
  // 🔥 ПОЛУЧИТЬ ОТПЕЧАТОК ПОЛЬЗОВАТЕЛЯ
  getUserFootprint(userId) {
    return this.userFootprints.get(userId);
  }
 
  // 🔥 ВИЗУАЛИЗИРОВАТЬ ОТПЕЧАТОК
  async visualizeUserFootprint(userId) {
    const footprint = this.getUserFootprint(userId);
    if (!footprint || !this.visualizer) return null;
   
    try {
      return await this.visualizer.visualizeAccumulativeFootprint(footprint, {
        filename: `user_${userId}_${Date.now()}.png`
      });
    } catch (error) {
      console.log(`❌ Ошибка визуализации:`, error.message);
      return null;
    }
  }

  // 🔥 МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ С СТАРОЙ СИСТЕМОЙ
 
  getActiveSession(userId) {
    console.log(`🔍 [COMPAT] getActiveSession(${userId}) called`);
   
    // Просто возвращаем отпечаток пользователя как сессию
    const footprint = this.userFootprints.get(userId);
    if (!footprint) {
      console.log(`⚠️ Нет активного отпечатка для пользователя ${userId}`);
      return null;
    }
   
    // Создаем объект сессии для совместимости
    return {
      id: `session_${userId}_${footprint.id}`,
      userId: userId,
      currentFootprint: footprint,
      photos: footprint.photoHistory || [],
      metadata: {
        createdAt: new Date(),
        lastActivity: new Date(),
        footprintId: footprint.id
      },
      lastActivity: new Date()
    };
  }
 
  getSessionInfo(userId) {
    const footprint = this.userFootprints.get(userId);
    if (!footprint) {
      return { exists: false, message: 'Нет активного отпечатка' };
    }
   
    return {
      exists: true,
      sessionId: `session_${userId}_${footprint.id}`,
      userId: userId,
      footprintId: footprint.id,
      totalPhotos: footprint.metadata.totalPhotos || 0,
      pointsCount: footprint.pointTracker?.points?.size || 0,
      lastActivity: footprint.metadata.lastUpdated || new Date()
    };
  }
 
  hasSession(userId) {
    return this.userFootprints.has(userId);
  }
 
  createSession(userId, name = null) {
    console.log(`🔍 [COMPAT] createSession(${userId}, ${name}) called`);
   
    // Если уже есть отпечаток - возвращаем его
    let footprint = this.userFootprints.get(userId);
   
    if (!footprint) {
      const SimpleFootprint = require('./simple-footprint');
      footprint = new SimpleFootprint({
        userId: userId,
        name: name || `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
        debug: this.config.debug
      });
     
      this.userFootprints.set(userId, footprint);
      this.systemStats.totalUsers++;
    }
   
    return {
      id: `session_${userId}_${footprint.id}`,
      userId: userId,
      currentFootprint: footprint,
      photos: [],
      metadata: {
        createdAt: new Date(),
        name: name || 'Новая сессия'
      }
    };
  }
 
  getOrCreateSession(userId) {
    return this.createSession(userId);
  }
 
  updateLastActivity(userId) {
    const footprint = this.userFootprints.get(userId);
    if (footprint) {
      footprint.metadata.lastUpdated = new Date();
      return true;
    }
    return false;
  }
 
  // 🔥 СРАВНЕНИЕ ОТПЕЧАТКОВ (для совместимости)
  async compareFootprints(footprint1, footprint2, options = {}) {
    console.log(`🔍 [COMPAT] compareFootprints() called`);
   
    try {
      // Используем геометрический алгоритм
      const result = await this.geometricAlgorithm.comparePoints(
        this.extractPointsForComparison(footprint1),
        this.extractPointsForComparison(footprint2),
        footprint1.name || 'След 1',
        footprint2.name || 'След 2'
      );
     
      return {
        similar: result.similar,
        similarity: result.similarity,
        decision: result.decision,
        matches: result.matches || [],
        stats: result.stats || {},
        method: 'geometric_algorithm'
      };
     
    } catch (error) {
      console.error(`❌ Ошибка сравнения: ${error.message}`);
     
      // Фаллбэк
      return {
        similar: false,
        similarity: 0,
        decision: 'different',
        error: error.message,
        method: 'fallback'
      };
    }
  }
 
  extractPointsForComparison(footprint) {
    const points = [];
   
    if (footprint.pointTracker && footprint.pointTracker.points) {
      for (const [id, point] of footprint.pointTracker.points) {
        points.push({
          id: id,
          x: point.x,
          y: point.y,
          confidence: point.confidence || 0.5,
          confirmedCount: point.confirmations || 1
        });
      }
    }
   
    return points;
  }
  
}

module.exports = SimpleFootprintManager;
