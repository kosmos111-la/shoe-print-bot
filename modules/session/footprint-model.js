// modules/session/footprint-model.js
// Аккумулятивная модель следа с верификацией узлов

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
 
  /**
   * Обновление узла при новом обнаружении
   */
  update(position, confidenceBoost = 0.1, photoId = null) {
    // Взвешенное обновление позиции
    const weight = this.confidence;
    const boostWeight = confidenceBoost;
   
    this.position = {
      x: (this.position.x * weight + position.x * boostWeight) / (weight + boostWeight),
      y: (this.position.y * weight + position.y * boostWeight) / (weight + boostWeight)
    };
   
    // Увеличиваем уверенность
    this.confidence = Math.min(this.confidence + confidenceBoost, 1.0);
    this.occurrences++;
    this.lastSeen = new Date();
   
    if (photoId) {
      this.photoIds.add(photoId);
    }
   
    return this.confidence;
  }
 
  /**
   * Постепенное снижение уверенности если узел не подтверждается
   */
  decay(decayRate = 0.05) {
    this.confidence = Math.max(this.confidence - decayRate, 0.1);
    return this.confidence;
  }
 
  /**
   * Проверка высокой уверенности
   */
  isHighConfidence(threshold = 0.7) {
    return this.confidence >= threshold;
  }
 
  /**
   * Получение информации об узле
   */
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
    this.photosProcessed = 0;
    this.photoMap = new Map(); // photoId -> {timestamp, nodeCount}
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
      ...photoInfo
    });
   
    // Группируем предсказания
    const protectors = normalizedPredictions.filter(p => p.class === 'shoe-protector');
    const outlines = normalizedPredictions.filter(p => p.class === 'Outline-trail');
   
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
   
    return {
      ...processed,
      stats: this.getStats(),
      modelInfo: this.getModelInfo()
    };
  }
 
  /**
   * Обработка протекторов
   */
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
 
  /**
   * Поиск ближайшего узла
   */
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
 
  /**
   * Обновление связей между узлами
   */
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
 
  /**
   * "Старение" неподтверждённых узлов
   */
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
    if (stats.highConfidenceNodes >= 10) return '✅ ГОТОВА';
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
   
    if (stats.modelConfidence < 0.6) {
      recs.push('Снимите те же участки с более близкого расстояния');
    }
   
    if (stats.totalNodes < 8 && stats.photosProcessed >= 2) {
      recs.push('Попробуйте другое освещение для выявления деталей');
    }
   
    return recs.length > 0 ? recs : ['Модель в хорошем состоянии ✓'];
  }
 
  /**
   * Быстрая проверка фрагмента
   */
  quickCheck(fragmentCenters, maxDistance = 30) {
    const matches = [];
   
    fragmentCenters.forEach(fragCenter => {
      const nearestNode = this.findNearestNode(fragCenter, maxDistance);
      if (nearestNode) {
        matches.push({
          node: nearestNode.getInfo(),
          fragmentCenter,
          distance: this.distance(fragCenter, nearestNode.position),
          confidence: nearestNode.confidence
        });
      }
    });
   
    return {
      matches,
      matchCount: matches.length,
      matchPercentage: this.nodes.size > 0 ?
        (matches.length / this.nodes.size * 100) : 0,
      isMatch: matches.length >= Math.max(3, this.nodes.size * 0.3)
    };
  }
 
  /**
   * Вспомогательные методы
   */
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
   * Экспорт модели
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
   
    const photos = {};
    for (const [id, photo] of this.photoMap) {
      photos[id] = photo;
    }
   
    return {
      sessionId: this.sessionId,
      nodes,
      edges,
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
