// modules/comparison/similarity-engine.js
class SimilarityEngine {
  constructor() {
    this.matchThreshold = 0.7; // порог совпадения
    this.positionTolerance = 25; // пикселей
  }
 
  // Основной метод сравнения
  compareWithModel(fragmentPredictions, model, options = {}) {
    const {
      allowMirroring = true,
      requireHighConfidence = false,
      minNodesForMatch = 3
    } = options;
   
    // Нормализуем фрагмент относительно модели
    const normalizedFragment = this.normalizeFragment(fragmentPredictions, model);
   
    // Сравниваем с консенсусной моделью
    const consensusModel = model.getConsensusModel(
      requireHighConfidence ? 0.7 : 0.5
    );
   
    // Поиск совпадений
    const matches = this.findMatches(normalizedFragment, consensusModel);
   
    // Проверяем зеркальное отражение если нужно
    let mirrorMatches = [];
    if (allowMirroring && matches.length < minNodesForMatch) {
      const mirrored = this.mirrorFragment(normalizedFragment);
      mirrorMatches = this.findMatches(mirrored, consensusModel);
    }
   
    // Выбираем лучший результат
    const bestMatches = mirrorMatches.length > matches.length ? mirrorMatches : matches;
    const isMirrored = mirrorMatches.length > matches.length;
   
    // Рассчитываем метрики
    const metrics = this.calculateMetrics(bestMatches, normalizedFragment, consensusModel);
   
    return {
      matches: bestMatches,
      metrics,
      isMirrored,
      confidence: metrics.confidence,
      isMatch: this.isConsideredMatch(metrics, minNodesForMatch)
    };
  }
 
  // Нормализация фрагмента относительно модели
  normalizeFragment(fragment, model) {
    // Упрощённая нормализация - центрируем
    const centers = fragment
      .filter(p => p.class === 'shoe-protector')
      .map(p => this.getCenter(p.points));
   
    if (centers.length === 0) return fragment;
   
    const centroid = this.calculateCentroid(centers);
   
    return fragment.map(pred => ({
      ...pred,
      points: pred.points.map(p => ({
        x: p.x - centroid.x,
        y: p.y - centroid.y
      }))
    }));
  }
 
  // Поиск совпадений между фрагментом и моделью
  findMatches(fragment, model) {
    const matches = [];
   
    const fragmentNodes = fragment
      .filter(p => p.class === 'shoe-protector')
      .map(p => ({
        center: this.getCenter(p.points),
        confidence: p.confidence || 0.5,
        id: `frag_${Math.random().toString(36).substr(2, 9)}`
      }));
   
    // Для каждого узла модели ищем ближайший узел фрагмента
    model.nodes.forEach(modelNode => {
      let bestMatch = null;
      let bestDistance = Infinity;
     
      fragmentNodes.forEach(fragNode => {
        const dist = this.distance(modelNode, fragNode.center);
        if (dist < this.positionTolerance && dist < bestDistance) {
          bestDistance = dist;
          bestMatch = {
            modelNode: { id: modelNode.id, ...modelNode },
            fragmentNode: fragNode,
            distance: dist,
            positionError: dist
          };
        }
      });
     
      if (bestMatch) {
        matches.push(bestMatch);
      }
    });
   
    return matches;
  }
 
  // Зеркальное отражение фрагмента (левый/правый ботинок)
  mirrorFragment(fragment) {
    return fragment.map(pred => ({
      ...pred,
      points: pred.points.map(p => ({
        x: -p.x, // зеркалим по X
        y: p.y
      }))
    }));
  }
 
  // Расчёт метрик совпадения
  calculateMetrics(matches, fragment, model) {
    if (matches.length === 0) {
      return {
        confidence: 0,
        coverage: 0,
        positionError: Infinity,
        nodesMatched: 0,
        totalNodes: model.nodes.length
      };
    }
   
    // Средняя ошибка позиции
    const avgPositionError = matches.reduce((sum, match) =>
      sum + match.positionError, 0) / matches.length;
   
    // Покрытие модели
    const coverage = matches.length / model.nodes.length;
   
    // Уверенность на основе качества совпадений
    const confidence = Math.min(
      coverage * 0.7 + // вес покрытия
      (1 - avgPositionError / this.positionTolerance) * 0.3, // вес точности
      1.0
    );
   
    return {
      confidence,
      coverage,
      positionError: avgPositionError,
      nodesMatched: matches.length,
      totalNodes: model.nodes.length,
      matchPercentage: (matches.length / model.nodes.length * 100).toFixed(1)
    };
  }
 
  // Определение, считается ли это совпадением
  isConsideredMatch(metrics, minNodes = 3) {
    return (
      metrics.nodesMatched >= minNodes &&
      metrics.confidence >= this.matchThreshold &&
      metrics.coverage >= 0.3
    );
  }
 
  // Быстрая проверка для полевого использования
  quickCheck(fragmentPredictions, model) {
    const result = this.compareWithModel(fragmentPredictions, model, {
      allowMirroring: true,
      requireHighConfidence: false,
      minNodesForMatch: 2
    });
   
    return {
      match: result.isMatch,
      confidence: result.confidence,
      nodesMatched: result.metrics.nodesMatched,
      message: this.generateMatchMessage(result)
    };
  }
 
  generateMatchMessage(result) {
    if (!result.isMatch) {
      return `❌ Не совпадает (${result.metrics.matchPercentage}%)`;
    }
   
    if (result.confidence > 0.9) {
      return `✅ Высокое совпадение (${result.metrics.matchPercentage}%)`;
    } else if (result.confidence > 0.7) {
      return `✅ Совпадает (${result.metrics.matchPercentage}%)`;
    } else {
      return `⚠️  Возможно совпадение (${result.metrics.matchPercentage}%)`;
    }
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
 
  calculateCentroid(points) {
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return {
      x: sum.x / points.length,
      y: sum.y / points.length
    };
  }
 
  distance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }
}

module.exports = { SimilarityEngine };
