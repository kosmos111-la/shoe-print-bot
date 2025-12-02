// modules/session/footprint-model.js
// Аккумулятивная модель следа с верификацией узлов и контурами

class FootprintNode {
  constructor(id, position, initialConfidence = 0.5) {
    this.id = id;
    this.position = position; // {x, y}
    this.confidence = initialConfidence;
    this.occurrences = 1; // сколько раз встречался
    this.firstSeen = new Date();
    this.lastSeen = new Date();
    this.class = 'protector'; // тип узла
    this.neighbors = []; // связи с другими узлами
    this.photoIds = new Set(); // ID фото, где был обнаружен
  }
 
  // ... существующие методы update, decay, isHighConfidence, getInfo ...
  update(position, confidenceBoost = 0.1, photoId = null) {
    const weight = this.confidence;
    const boostWeight = confidenceBoost;
   
    this.position = {
      x: (this.position.x * weight + position.x * boostWeight) / (weight + boostWeight),
      y: (this.position.y * weight + position.y * boostWeight) / (weight + boostWeight)
    };
   
    this.confidence = Math.min(this.confidence + confidenceBoost, 1.0);
    this.occurrences++;
    this.lastSeen = new Date();
   
    if (photoId) {
      this.photoIds.add(photoId);
    }
   
    return this.confidence;
  }
 
  decay(decayRate = 0.05) {
    this.confidence = Math.max(this.confidence - decayRate, 0.1);
    return this.confidence;
  }
 
  isHighConfidence(threshold = 0.7) {
    return this.confidence >= threshold;
  }
 
  getInfo() {
    return {
      id: this.id,
      position: this.position,
      confidence: this.confidence,
      occurrences: this.occurrences,
      lastSeen: this.lastSeen,
      photoCount: this.photoIds.size
    };
  }
}

class FootprintModel {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.nodes = new Map(); // nodeId -> FootprintNode
    this.edges = new Map(); // edgeId -> {node1, node2, confidence, distance}
   
    // 🆕 ХРАНИЛИЩЕ КОНТУРОВ
    this.contours = new Map(); // contourId -> {points, class, confidence, photoIds}
    this.contourHistory = []; // история изменений контуров
   
    this.photosProcessed = 0;
    this.photoMap = new Map(); // photoId -> {timestamp, nodeCount, contourCount}
    this.referenceScale = 1.0;
    this.referenceOrientation = 0;
    this.creationTime = new Date();
    this.lastUpdate = new Date();
   
    console.log(`🆕 FootprintModel создана для сессии ${sessionId}`);
  }
 
  /**
   * Добавление нового фото в модель
   */
  addPhotograph(normalizedPredictions, photoId, photoInfo = {}) {
    console.log(`📸 Добавляю фото ${photoId} в модель`);
   
    // Сохраняем информацию о фото
    this.photoMap.set(photoId, {
      timestamp: new Date(),
      nodeCount: 0,
      contourCount: 0,
      ...photoInfo
    });
   
    // Группируем предсказания
    const protectors = normalizedPredictions.filter(p => p.class === 'shoe-protector');
    const outlines = normalizedPredictions.filter(p => p.class === 'Outline-trail');
   
    // 🆕 СОХРАНЯЕМ КОНТУРЫ
    const contourResult = this.addContours(normalizedPredictions, photoId);
    console.log(`🎨 Сохранено контуров: ${contourResult.added}, всего: ${contourResult.total}`);
   
    // Обрабатываем протекторы (ключевые узлы)
    const processed = this.processProtectors(protectors, photoId);
   
    // Обновляем контуры если есть
    if (outlines.length > 0) {
      this.updateOutline(outlines);
    }
   
    // Обновляем связи между узлами
    this.updateEdges();
   
    // "Старение" неподтверждённых узлов
    this.applyDecay();
   
    this.photosProcessed++;
    this.lastUpdate = new Date();
   
    // Обновляем информацию о фото
    this.photoMap.get(photoId).nodeCount = processed.added + processed.updated;
    this.photoMap.get(photoId).contourCount = contourResult.added;
   
    return {
      ...processed,
      contours: contourResult,
      stats: this.getStats(),
      modelInfo: this.getModelInfo()
    };
  }
 
  /**
   * 🆕 ДОБАВЛЕНИЕ КОНТУРОВ ИЗ ПРЕДСКАЗАНИЙ
   */
  addContours(predictions, photoId) {
    console.log(`🎨 Сохраняю контуры из фото ${photoId}`);
   
    const newContours = [];
   
    predictions.forEach(pred => {
      if (pred.points && pred.points.length > 2) {
        // Для протекторов проверяем, не добавлен ли уже похожий
        if (pred.class === 'shoe-protector') {
          const existingContour = this.findSimilarContour(pred);
          if (existingContour) {
            // Обновляем существующий
            existingContour.photoIds.add(photoId);
            existingContour.confidence = Math.max(
              existingContour.confidence,
              pred.confidence || 0.5
            );
            existingContour.lastSeen = new Date();
            existingContour.occurrences = (existingContour.occurrences || 1) + 1;
            newContours.push(existingContour);
          } else {
            // Новый контур
            const contourId = `contour_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const newContour = {
              id: contourId,
              class: pred.class,
              points: pred.points,
              confidence: pred.confidence || 0.5,
              photoIds: new Set([photoId]),
              firstSeen: new Date(),
              lastSeen: new Date(),
              occurrences: 1,
              age: 0
            };
            this.contours.set(contourId, newContour);
            newContours.push(newContour);
          }
        } else {
          // Для других классов (Outline-trail, Heel, Toe) - всегда добавляем
          const contourId = `contour_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          const newContour = {
            id: contourId,
            class: pred.class,
            points: pred.points,
            confidence: pred.confidence || 0.5,
            photoIds: new Set([photoId]),
            firstSeen: new Date(),
            lastSeen: new Date(),
            occurrences: 1,
            age: 0
          };
          this.contours.set(contourId, newContour);
          newContours.push(newContour);
        }
      }
    });
   
    // Сохраняем в историю
    this.contourHistory.push({
      timestamp: new Date(),
      photoId,
      contoursAdded: newContours.length
    });
   
    return {
      added: newContours.length,
      total: this.contours.size
    };
  }
 
  /**
   * 🆕 ПОИСК ПОХОЖЕГО КОНТУРА
   */
  findSimilarContour(newContour) {
    if (this.contours.size === 0) return null;
   
    const newCenter = this.getCenter(newContour.points);
    let mostSimilar = null;
    let minDistance = Infinity;
   
    for (const [contourId, contour] of this.contours) {
      if (contour.class !== newContour.class) continue;
     
      const contourCenter = this.getCenter(contour.points);
      const distance = this.distance(newCenter, contourCenter);
     
      // Если центры близко (<20px) и класс совпадает - считаем похожим
      if (distance < 20 && distance < minDistance) {
        minDistance = distance;
        mostSimilar = contour;
      }
    }
   
    return mostSimilar;
  }
 
  /**
   * 🆕 ПОЛУЧЕНИЕ КОНТУРОВ ДЛЯ ВИЗУАЛИЗАЦИИ
   */
  getContoursForVisualization(minConfidence = 0.3) {
    const visibleContours = [];
    const now = new Date();
   
    for (const [contourId, contour] of this.contours) {
      // Фильтруем по уверенности
      if (contour.confidence < minConfidence) continue;
     
      // Вычисляем "возраст" контура
      const ageMinutes = (now - contour.lastSeen) / (1000 * 60);
      contour.age = ageMinutes;
     
      visibleContours.push({
        id: contourId,
        class: contour.class,
        points: contour.points,
        confidence: contour.confidence,
        occurrences: contour.occurrences,
        photoCount: contour.photoIds.size,
        age: ageMinutes,
        isRecent: ageMinutes < 5
      });
    }
   
    // Сортируем: сначала основные контуры, потом детали
    visibleContours.sort((a, b) => {
      const priority = {
        'Outline-trail': 1,
        'Heel': 2,
        'Toe': 3,
        'shoe-protector': 4
      };
      return (priority[a.class] || 99) - (priority[b.class] || 99);
    });
   
    return visibleContours;
  }
 
  /**
   * 🆕 ПОЛУЧЕНИЕ СПЕЦИАЛЬНЫХ ТОЧЕК (КАБЛУК, НОСОК)
   */
  getSpecialPoints() {
    const specialPoints = {};
   
    for (const [contourId, contour] of this.contours) {
      if (contour.class === 'Heel' || contour.class === 'Toe') {
        const center = this.getCenter(contour.points);
        specialPoints[contour.class.toLowerCase()] = {
          x: center.x,
          y: center.y,
          confidence: contour.confidence,
          occurrences: contour.occurrences
        };
      }
    }
   
    return specialPoints;
  }
 
  /**
   * 🆕 ПОЛУЧЕНИЕ КОНТУРОВ ДЛЯ ЭКСПОРТА
   */
  getContoursForExport() {
    const result = [];
   
    for (const [contourId, contour] of this.contours) {
      result.push({
        id: contourId,
        class: contour.class,
        points: contour.points,
        confidence: contour.confidence,
        occurrences: contour.occurrences,
        photoCount: contour.photoIds.size,
        firstSeen: contour.firstSeen,
        lastSeen: contour.lastSeen
      });
    }
   
    return result;
  }
 
  // ... существующие методы (processProtectors, findNearestNode, updateEdges, applyDecay) ...
  processProtectors(protectors, photoId) {
    let added = 0;
    let updated = 0;
    let skipped = 0;
   
    protectors.forEach(protector => {
      const center = this.getCenter(protector.points);
      const confidence = protector.confidence || 0.5;
     
      // Ищем ближайший существующий узел
      const nearestNode = this.findNearestNode(center, 25); // радиус 25 пикселей
     
      if (nearestNode) {
        // Узел уже существует - обновляем
        const confidenceBoost = confidence * 0.15; // 15% от confidence детекции
        nearestNode.update(center, confidenceBoost, photoId);
        updated++;
      } else {
        // Новый узел - добавляем
        const nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const newNode = new FootprintNode(nodeId, center, confidence);
        newNode.photoIds.add(photoId);
        this.nodes.set(nodeId, newNode);
        added++;
      }
    });
   
    return { added, updated, skipped };
  }
 
  findNearestNode(point, maxDistance) {
    let nearest = null;
    let minDist = Infinity;
   
    for (const [nodeId, node] of this.nodes) {
      const dist = this.distance(point, node.position);
      if (dist < minDist && dist < maxDistance) {
        minDist = dist;
        nearest = node;
      }
    }
   
    return nearest;
  }
 
  updateEdges() {
    this.edges.clear();
   
    const nodeArray = Array.from(this.nodes.values());
   
    for (let i = 0; i < nodeArray.length; i++) {
      for (let j = i + 1; j < nodeArray.length; j++) {
        const node1 = nodeArray[i];
        const node2 = nodeArray[j];
       
        const dist = this.distance(node1.position, node2.position);
       
        // Создаём связь если узлы близко и оба с достаточной уверенностью
        if (dist < 120 && node1.confidence > 0.4 && node2.confidence > 0.4) {
          const edgeId = `edge_${node1.id}_${node2.id}`;
          const edgeConfidence = Math.min(node1.confidence, node2.confidence);
         
          this.edges.set(edgeId, {
            node1: node1.id,
            node2: node2.id,
            distance: dist,
            confidence: edgeConfidence,
            lastUpdated: new Date()
          });
        }
      }
    }
  }
 
  applyDecay() {
    const now = new Date();
    const decayThreshold = 2 * 60 * 1000; // 2 минуты
   
    for (const [nodeId, node] of this.nodes) {
      const timeSinceLastSeen = now - node.lastSeen;
      if (timeSinceLastSeen > decayThreshold && node.confidence > 0.2) {
        node.decay(0.03); // 3% decay
      }
    }
  }
 
  /**
   * Получение консенсусной модели
   */
  getConsensusModel(minConfidence = 0.5) {
    const consensusNodes = [];
    const consensusEdges = [];
   
    // Фильтруем узлы по уверенности
    for (const [nodeId, node] of this.nodes) {
      if (node.confidence >= minConfidence) {
        consensusNodes.push({
          id: nodeId,
          ...node.position,
          confidence: node.confidence,
          occurrences: node.occurrences,
          photoCount: node.photoIds.size
        });
      }
    }
   
    // Фильтруем связи
    for (const [edgeId, edge] of this.edges) {
      const node1 = this.nodes.get(edge.node1);
      const node2 = this.nodes.get(edge.node2);
     
      if (node1 && node2 &&
          node1.confidence >= minConfidence &&
          node2.confidence >= minConfidence) {
        consensusEdges.push(edge);
      }
    }
   
    return {
      nodes: consensusNodes,
      edges: consensusEdges,
      timestamp: new Date(),
      photosProcessed: this.photosProcessed,
      confidence: this.calculateModelConfidence(),
      nodeCount: consensusNodes.length,
      edgeCount: consensusEdges.length
    };
  }
 
  /**
   * 🆕 ПРОДВИНУТЫЙ ЭКСПОРТ С КОНТУРАМИ
   */
  getFullModel(minConfidence = 0.5) {
    const consensus = this.getConsensusModel(minConfidence);
   
    return {
      ...consensus,
      contours: this.getContoursForVisualization(minConfidence * 0.8), // менее строгий порог для контуров
      specialPoints: this.getSpecialPoints(),
      contourCount: this.contours.size,
      modelInfo: this.getModelInfo()
    };
  }
 
  /**
   * Расчёт общей уверенности модели
   */
  calculateModelConfidence() {
    if (this.nodes.size === 0) return 0;
   
    let totalConfidence = 0;
    let count = 0;
   
    for (const [nodeId, node] of this.nodes) {
      totalConfidence += node.confidence;
      count++;
    }
   
    return totalConfidence / count;
  }
 
  /**
   * Статистика модели
   */
  getStats() {
    const now = new Date();
    const consensus = this.getConsensusModel(0.4);
    const highConfidence = this.getConsensusModel(0.7);
   
    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      totalContours: this.contours.size,
      consensusNodes: consensus.nodes.length,
      highConfidenceNodes: highConfidence.nodes.length,
      modelConfidence: this.calculateModelConfidence(),
      photosProcessed: this.photosProcessed,
      ageMinutes: Math.round((now - this.creationTime) / (1000 * 60)),
      lastUpdateMinutes: Math.round((now - this.lastUpdate) / (1000 * 60))
    };
  }
 
  /**
   * Информация о модели для пользователя
   */
  getModelInfo() {
    const stats = this.getStats();
   
    return {
      sessionId: this.sessionId,
      ...stats,
      status: this.getModelStatus(),
      recommendations: this.getRecommendations()
    };
  }
 
  /**
   * Статус модели
   */
  getModelStatus() {
    const stats = this.getStats();
   
    if (stats.photosProcessed === 0) return '🆕 НОВАЯ';
    if (stats.highConfidenceNodes >= 10 && stats.totalContours >= 5) return '✅ ГОТОВА (с контурами)';
    if (stats.modelConfidence >= 0.7) return '⚡ АКТИВНА';
    if (stats.photosProcessed >= 3) return '📈 РАЗВИВАЕТСЯ';
    return '🧱 ФОРМИРУЕТСЯ';
  }
 
  /**
   * Рекомендации по улучшению модели
   */
  getRecommendations() {
    const stats = this.getStats();
    const recs = [];
   
    if (stats.photosProcessed === 0) {
      recs.push('Отправьте первое фото следа');
    } else if (stats.photosProcessed < 3) {
      recs.push(`Отправьте ещё ${3 - stats.photosProcessed} фото под разными углами`);
    }
   
    if (stats.highConfidenceNodes < 5) {
      recs.push('Сфокусируйтесь на деталях протектора');
    }
   
    if (stats.totalContours < 3) {
      recs.push('Убедитесь, что контуры отрисовываются чётко');
    }
   
    if (stats.modelConfidence < 0.6) {
      recs.push('Снимите те же участки с более близкого расстояния');
    }
   
    if (stats.totalNodes < 8 && stats.photosProcessed >= 2) {
      recs.push('Попробуйте другое освещение для выявления деталей');
    }
   
    return recs.length > 0 ? recs : ['Модель в хорошем состоянии ✓'];
  }
 
  updateOutline(outlines) {
    // Простая обработка контуров - можно улучшить
    console.log(`📐 Обнаружено контуров: ${outlines.length}`);
  }
 
  // Вспомогательные методы
  getCenter(points) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2
    };
  }
 
  distance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }
 
  /**
   * Экспорт модели в JSON
   */
  toJSON() {
    const nodes = {};
    for (const [id, node] of this.nodes) {
      nodes[id] = {
        position: node.position,
        confidence: node.confidence,
        occurrences: node.occurrences,
        class: node.class,
        firstSeen: node.firstSeen,
        lastSeen: node.lastSeen,
        photoIds: Array.from(node.photoIds)
      };
    }
   
    const edges = {};
    for (const [id, edge] of this.edges) {
      edges[id] = edge;
    }
   
    const contours = {};
    for (const [id, contour] of this.contours) {
      contours[id] = {
        class: contour.class,
        points: contour.points,
        confidence: contour.confidence,
        occurrences: contour.occurrences,
        photoIds: Array.from(contour.photoIds),
        firstSeen: contour.firstSeen,
        lastSeen: contour.lastSeen
      };
    }
   
    const photos = {};
    for (const [id, photo] of this.photoMap) {
      photos[id] = photo;
    }
   
    return {
      sessionId: this.sessionId,
      nodes,
      edges,
      contours,
      photos,
      photosProcessed: this.photosProcessed,
      referenceScale: this.referenceScale,
      referenceOrientation: this.referenceOrientation,
      creationTime: this.creationTime,
      lastUpdate: this.lastUpdate
    };
  }
}

module.exports = { FootprintNode, FootprintModel };
