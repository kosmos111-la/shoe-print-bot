// modules/footprint/simple-footprint.js
// 🔥 УПРОЩЕННЫЙ ОТПЕЧАТОК С АККУМУЛЯЦИОННЫМ ТРЕКЕРОМ

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const SimpleGraph = require('./simple-graph');
const PointTracker = require('./point-tracker');

class SimpleFootprint {
  constructor(options = {}) {
    this.id = options.id || `fp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    this.name = options.name || `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`;
    this.userId = options.userId || null;
   
    // 🔥 ПРОСТОЙ ГРАФ
    this.graph = options.graph || new SimpleGraph(this.name);
   
    // 🔥 АККУМУЛЯЦИОННЫЙ ТРЕКЕР
    this.pointTracker = options.pointTracker || new PointTracker({
      geometricHashPrecision: 5,
      maxNeighborsForPattern: 5,
      matchDistanceThreshold: 25,
      debug: options.debug || false
    });
   
    // Метаданные
    this.metadata = {
      created: new Date(),
      lastUpdated: new Date(),
      totalPhotos: 0,
      footprintType: options.footprintType || 'unknown',
      features: {
        hasGraph: true,
        hasPointTracker: true,
        accumulative: true
      },
      ...(options.metadata || {})
    };
   
    this.stats = {
      confidence: options.confidence || 0.5,
      nodeCount: 0,
      edgeCount: 0,
      qualityScore: 0,
      confirmations: 0
    };
   
    this.photoHistory = [];
    this.analysisHistory = [];
   
    console.log(`👣 Создан упрощенный отпечаток "${this.name}" с аккумуляционным трекером`);
  }
 
  // 🔥 ОСНОВНОЙ МЕТОД: Добавить анализ
  addAnalysis(analysis, sourceInfo = {}) {
    console.log(`📥 Добавляю анализ в "${this.name}"...`);
   
    // Извлекаем точки протекторов
    const protectorPoints = this.extractProtectorPoints(analysis.predictions);
   
    if (protectorPoints.length < 3) {
      console.log(`⚠️ Слишком мало протекторов: ${protectorPoints.length}`);
      return { error: 'Not enough protectors', added: 0 };
    }
   
    console.log(`🔍 Найдено ${protectorPoints.length} протекторов`);
   
    // 🔥 ДОБАВЛЯЕМ ТОЧКИ В АККУМУЛЯЦИОННЫЙ ТРЕКЕР
    const trackerResults = this.pointTracker.addPointsFromFootprint(
      protectorPoints,
      this.id, // footprintId
      {
        photoId: sourceInfo.photoId || `photo_${Date.now()}`,
        source: sourceInfo.source || 'direct_photo',
        timestamp: new Date(),
        ...sourceInfo
      }
    );
   
    console.log(`🎯 Трекер: ${trackerResults.added} новых, ${trackerResults.confirmed} подтверждено`);
   
    // 🔥 СОЗДАЕМ ГРАФ ИЗ ВСЕХ ТОЧЕК ТРЕКЕРА
    const allPoints = this.pointTracker.getAllPointsForVisualization();
    const previousNodeCount = this.graph.nodes.size;
   
    if (allPoints.length > 0) {
      // Строим граф из всех накопленных точек
      const graphPoints = allPoints.map(point => ({
        x: point.x,
        y: point.y,
        confidence: point.confidence,
        id: point.id
      }));
     
      const graphInvariants = this.graph.buildFromPoints(graphPoints);
     
      console.log(`🏗️ Граф построен: ${this.graph.nodes.size} узлов (+${this.graph.nodes.size - previousNodeCount})`);
    }
   
    // Сохраняем в историю
    this.analysisHistory.push({
      id: `analysis_${Date.now()}`,
      timestamp: new Date(),
      pointsCount: protectorPoints.length,
      trackerResults: trackerResults,
      sourceInfo: sourceInfo
    });
   
    this.photoHistory.push({
      timestamp: new Date(),
      points: protectorPoints.length,
      source: sourceInfo,
      trackerResults: trackerResults
    });
   
    // Обновляем метаданные
    this.metadata.totalPhotos++;
    this.metadata.lastUpdated = new Date();
   
    // Обновляем статистику
    this.updateStats();
   
    const addedNodes = this.graph.nodes.size - previousNodeCount;
   
    console.log(`✅ Анализ добавлен: +${addedNodes} узлов, всего узлов: ${this.graph.nodes.size}`);
   
    return {
      success: true,
      added: addedNodes,
      totalNodes: this.graph.nodes.size,
      trackerResults: trackerResults,
      confidence: this.stats.confidence
    };
  }
 
  // 🔥 ОБНОВЛЕНИЕ СТАТИСТИКИ
  updateStats() {
    const trackerStats = this.pointTracker.getStats();
   
    this.stats.nodeCount = this.graph.nodes.size;
    this.stats.edgeCount = this.graph.edges.size;
    this.stats.confirmations = trackerStats.avgConfirmations;
   
    // Уверенность на основе подтверждений
    const confirmationScore = Math.min(1, trackerStats.avgConfirmations / 3);
    const nodeScore = Math.min(1, this.graph.nodes.size / 50);
   
    this.stats.confidence = (confirmationScore * 0.7 + nodeScore * 0.3);
    this.stats.qualityScore = this.stats.confidence * Math.min(1, this.metadata.totalPhotos / 3);
   
    this.stats.trackerStats = trackerStats;
  }
 
  // 🔥 ПОЛУЧИТЬ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
  getVisualizationData() {
    const trackerStats = this.pointTracker.getStats();
    const allPoints = this.pointTracker.getAllPointsForVisualization();
   
    return {
      id: this.id,
      name: this.name,
      totalPhotos: this.metadata.totalPhotos,
      points: allPoints,
      stats: trackerStats,
      metadata: {
        ...this.metadata,
        createdAt: this.metadata.created.toLocaleString('ru-RU'),
        lastUpdated: this.metadata.lastUpdated.toLocaleString('ru-RU')
      },
      accumulative: true,
      note: 'Аккумуляционная модель - показываются все точки из всех следов'
    };
  }
 
  // 🔥 ИНФОРМАЦИЯ ОБ ОТПЕЧАТКЕ
  getInfo() {
    const trackerStats = this.pointTracker.getStats();
   
    return {
      id: this.id,
      name: this.name,
      userId: this.userId,
      stats: {
        ...this.stats,
        qualityScore: Math.round(this.stats.qualityScore * 100),
        confidence: Math.round(this.stats.confidence * 100)
      },
      metadata: {
        ...this.metadata,
        created: this.metadata.created.toLocaleString('ru-RU'),
        lastUpdated: this.metadata.lastUpdated.toLocaleString('ru-RU'),
        features: this.metadata.features
      },
      trackerStats: trackerStats,
      graph: {
        nodes: this.graph.nodes.size,
        edges: this.graph.edges.size
      },
      accumulative: true
    };
  }
 
  // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  extractProtectorPoints(predictions) {
    const points = [];
   
    const protectors = predictions.filter(p =>
      p.class === 'shoe-protector' ||
      (p.class && p.class.toLowerCase().includes('protector'))
    );
   
    if (protectors.length === 0 && predictions.length > 0) {
      console.log('⚠️ Нет класса shoe-protector, использую все точки с confidence > 0.3');
     
      predictions.forEach((pred, index) => {
        if ((pred.confidence || 0) > 0.3 && pred.points && pred.points.length > 0) {
          const center = this.calculateCenter(pred.points);
          points.push({
            x: center.x,
            y: center.y,
            confidence: pred.confidence || 0.5,
            originalPoints: pred.points
          });
        }
      });
    } else {
      protectors.forEach(protector => {
        if (protector.points && protector.points.length > 0) {
          const center = this.calculateCenter(protector.points);
          points.push({
            x: center.x,
            y: center.y,
            confidence: protector.confidence || 0.5,
            originalPoints: protector.points
          });
        }
      });
    }
   
    return points;
  }
 
  calculateCenter(points) {
    if (!points || points.length === 0) {
      return { x: 0, y: 0 };
    }
   
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
   
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2
    };
  }
 
  // 🔥 ДЛЯ СОВМЕСТИМОСТИ
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      userId: this.userId,
      graph: this.graph.toJSON(),
      pointTracker: this.pointTracker.toJSON(),
      metadata: {
        ...this.metadata,
        created: this.metadata.created.toISOString(),
        lastUpdated: this.metadata.lastUpdated.toISOString()
      },
      stats: this.stats,
      analysisHistory: this.analysisHistory,
      photoHistory: this.photoHistory,
      _version: '3.0-simple-accumulative',
      _savedAt: new Date().toISOString()
    };
  }
 
  static fromJSON(data) {
    console.log(`📂 Загружаю упрощенный отпечаток "${data.name}"...`);
   
    const graph = SimpleGraph.fromJSON(data.graph);
    const pointTracker = PointTracker.fromJSON(data.pointTracker);
   
    const footprint = new SimpleFootprint({
      id: data.id,
      name: data.name,
      userId: data.userId,
      graph: graph,
      pointTracker: pointTracker,
      metadata: data.metadata,
      confidence: data.stats?.confidence
    });
   
    if (Array.isArray(data.analysisHistory)) {
      footprint.analysisHistory = data.analysisHistory;
    }
   
    if (Array.isArray(data.photoHistory)) {
      footprint.photoHistory = data.photoHistory;
    }
   
    if (data.stats) {
      footprint.stats = { ...footprint.stats, ...data.stats };
    }
   
    console.log(`✅ Загружен отпечаток "${footprint.name}" с аккумуляционным трекером`);
   
    return footprint;
  }
}

module.exports = SimpleFootprint;
