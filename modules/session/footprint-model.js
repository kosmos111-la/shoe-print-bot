// modules/session/footprint-model.js
// Шаг 3.1: Создаём класс FootprintNode
class FootprintNode {
  constructor(id, position, initialConfidence = 0.5) {
    this.id = id;
    this.position = position; // {x, y}
    this.confidence = initialConfidence;
    this.occurrences = 1; // сколько раз встречался
    this.firstSeen = new Date();
    this.lastSeen = new Date();
    this.class = ''; // тип узла (протектор, контур и т.д.)
    this.neighbors = []; // связи с другими узлами
  }
 
  update(position, confidenceBoost = 0.1) {
    // Обновляем позицию с учётом веса уверенности
    const weight = this.confidence;
    this.position = {
      x: (this.position.x * weight + position.x * confidenceBoost) / (weight + confidenceBoost),
      y: (this.position.y * weight + position.y * confidenceBoost) / (weight + confidenceBoost)
    };
   
    this.confidence = Math.min(this.confidence + confidenceBoost, 1.0);
    this.occurrences++;
    this.lastSeen = new Date();
  }
 
  decay(decayRate = 0.05) {
    // Постепенное снижение уверенности если узел не подтверждается
    this.confidence = Math.max(this.confidence - decayRate, 0.1);
  }
 
  isHighConfidence(threshold = 0.7) {
    return this.confidence >= threshold;
  }
}

// Шаг 3.2: Создаём класс FootprintModel
class FootprintModel {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.nodes = new Map(); // nodeId -> FootprintNode
    this.edges = new Map(); // edgeId -> {node1, node2, confidence}
    this.photosProcessed = 0;
    this.referenceScale = 1.0;
    this.referenceOrientation = 0;
    this.creationTime = new Date();
    this.lastUpdate = new Date();
  }
 
  // Добавление нового фото в модель
  addPhotograph(normalizedPredictions, photoId) {
    console.log(`📸 Добавляю фото ${photoId} в модель ${this.sessionId}`);
   
    // Группируем предсказания по классам
    const protectors = normalizedPredictions.filter(p => p.class === 'shoe-protector');
    const outlines = normalizedPredictions.filter(p => p.class === 'Outline-trail');
   
    // 1. Обрабатываем протекторы (ключевые узлы)
    this.processProtectors(protectors);
   
    // 2. Обновляем контуры если есть
    if (outlines.length > 0) {
      this.updateOutline(outlines);
    }
   
    // 3. Обновляем связи между узлами
    this.updateEdges();
   
    // 4. "Старение" неподтверждённых узлов
    this.applyDecay();
   
    this.photosProcessed++;
    this.lastUpdate = new Date();
   
    return this.getStats();
  }
 
  processProtectors(protectors) {
    protectors.forEach(protector => {
      const center = this.getCenter(protector.points);
      const confidence = protector.confidence || 0.5;
     
      // Ищем ближайший существующий узел
      const nearestNode = this.findNearestNode(center, 30); // радиус 30 пикселей
     
      if (nearestNode) {
        // Узел уже существует - обновляем
        nearestNode.update(center, confidence * 0.2);
        console.log(`✅ Узел ${nearestNode.id} подтверждён`);
      } else {
        // Новый узел - добавляем
        const nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newNode = new FootprintNode(nodeId, center, confidence);
        newNode.class = 'protector';
        this.nodes.set(nodeId, newNode);
        console.log(`➕ Добавлен новый узел ${nodeId}`);
      }
    });
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
    // Обновляем связи между узлами на основе их позиций
    this.edges.clear();
   
    const nodeArray = Array.from(this.nodes.values());
   
    for (let i = 0; i < nodeArray.length; i++) {
      for (let j = i + 1; j < nodeArray.length; j++) {
        const dist = this.distance(nodeArray[i].position, nodeArray[j].position);
       
        // Если узлы близко и оба с высокой уверенностью - создаём связь
        if (dist < 150 && nodeArray[i].confidence > 0.5 && nodeArray[j].confidence > 0.5) {
          const edgeId = `edge_${nodeArray[i].id}_${nodeArray[j].id}`;
          this.edges.set(edgeId, {
            node1: nodeArray[i].id,
            node2: nodeArray[j].id,
            distance: dist,
            confidence: Math.min(nodeArray[i].confidence, nodeArray[j].confidence)
          });
        }
      }
    }
  }
 
  applyDecay() {
    // Снижаем уверенность у узлов, которые давно не подтверждались
    const now = new Date();
    const decayThreshold = 5 * 60 * 1000; // 5 минут
   
    for (const [nodeId, node] of this.nodes) {
      const timeSinceLastSeen = now - node.lastSeen;
      if (timeSinceLastSeen > decayThreshold && node.confidence > 0.2) {
        node.decay(0.02);
      }
    }
  }
 
  getConsensusModel(minConfidence = 0.6) {
    // Возвращает только высокоуверенные узлы
    const consensusNodes = [];
    const consensusEdges = [];
   
    for (const [nodeId, node] of this.nodes) {
      if (node.confidence >= minConfidence) {
        consensusNodes.push({
          id: nodeId,
          ...node.position,
          confidence: node.confidence,
          occurrences: node.occurrences
        });
      }
    }
   
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
      confidence: this.calculateModelConfidence()
    };
  }
 
  calculateModelConfidence() {
    let totalConfidence = 0;
    let count = 0;
   
    for (const [nodeId, node] of this.nodes) {
      totalConfidence += node.confidence;
      count++;
    }
   
    return count > 0 ? totalConfidence / count : 0;
  }
 
  getStats() {
    const consensus = this.getConsensusModel(0.4);
    const highConfidence = this.getConsensusModel(0.7);
   
    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      consensusNodes: consensus.nodes.length,
      highConfidenceNodes: highConfidence.nodes.length,
      modelConfidence: this.calculateModelConfidence(),
      photosProcessed: this.photosProcessed,
      ageMinutes: (new Date() - this.creationTime) / (1000 * 60)
    };
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
 
  // Экспорт модели для сохранения
  toJSON() {
    const nodes = {};
    for (const [id, node] of this.nodes) {
      nodes[id] = {
        position: node.position,
        confidence: node.confidence,
        occurrences: node.occurrences,
        class: node.class,
        firstSeen: node.firstSeen,
        lastSeen: node.lastSeen
      };
    }
   
    const edges = {};
    for (const [id, edge] of this.edges) {
      edges[id] = edge;
    }
   
    return {
      sessionId: this.sessionId,
      nodes,
      edges,
      photosProcessed: this.photosProcessed,
      creationTime: this.creationTime,
      lastUpdate: this.lastUpdate
    };
  }
 
  // Импорт модели из JSON
  static fromJSON(data) {
    const model = new FootprintModel(data.sessionId);
    model.photosProcessed = data.photosProcessed;
    model.creationTime = new Date(data.creationTime);
    model.lastUpdate = new Date(data.lastUpdate);
   
    for (const [id, nodeData] of Object.entries(data.nodes)) {
      const node = new FootprintNode(id, nodeData.position, nodeData.confidence);
      node.occurrences = nodeData.occurrences;
      node.class = nodeData.class;
      node.firstSeen = new Date(nodeData.firstSeen);
      node.lastSeen = new Date(nodeData.lastSeen);
      model.nodes.set(id, node);
    }
   
    for (const [id, edgeData] of Object.entries(data.edges)) {
      model.edges.set(id, edgeData);
    }
   
    return model;
  }
}

module.exports = { FootprintNode, FootprintModel };
