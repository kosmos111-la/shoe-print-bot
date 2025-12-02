// modules/comparison/similarity-engine.js
// Движок сравнения следов с учётом зеркалирования

class SimilarityEngine {
  constructor() {
    this.matchThreshold = 0.6; // порог совпадения
    this.positionTolerance = 35; // пикселей
    this.minNodesForMatch = 3;
    console.log('🔍 SimilarityEngine инициализирован');
  }
 
  /**
   * Основной метод сравнения фрагмента с моделью
   */
  compareFragmentWithModel(fragmentPredictions, model, options = {}) {
    const {
      allowMirroring = true,
      requireHighConfidence = false,
      quickMode = true
    } = options;
   
    console.log(`🔍 Сравниваю фрагмент (${fragmentPredictions.length} деталей) с моделью`);
   
    try {
      // Извлекаем центры из фрагмента
      const fragmentCenters = this.extractCenters(fragmentPredictions);
      if (fragmentCenters.length === 0) {
        return this.noMatchResult('Нет деталей для сравнения');
      }
     
      // Получаем консенсусную модель
      const minConfidence = requireHighConfidence ? 0.7 : 0.4;
      const consensusModel = model.getConsensusModel(minConfidence);
     
      if (consensusModel.nodes.length === 0) {
        return this.noMatchResult('Модель пуста');
      }
     
      // Быстрая проверка
      const quickResult = model.quickCheck(fragmentCenters, this.positionTolerance);
     
      if (quickMode) {
        return this.formatQuickResult(quickResult, fragmentCenters.length, consensusModel);
      }
     
      // Полная проверка с зеркалированием
      let bestResult = quickResult;
      let isMirrored = false;
     
      if (allowMirroring && quickResult.matchCount < this.minNodesForMatch) {
        const mirroredCenters = this.mirrorCenters(fragmentCenters);
        const mirrorResult = model.quickCheck(mirroredCenters, this.positionTolerance);
       
        if (mirrorResult.matchCount > bestResult.matchCount) {
          bestResult = mirrorResult;
          isMirrored = true;
          console.log('🪞 Использовано зеркальное отражение');
        }
      }
     
      return this.formatDetailedResult(
        bestResult,
        fragmentCenters.length,
        consensusModel,
        isMirrored
      );
     
    } catch (error) {
      console.log('❌ Ошибка сравнения:', error);
      return this.errorResult('Ошибка при сравнении');
    }
  }
 
  /**
   * Извлечение центров из предсказаний
   */
  extractCenters(predictions) {
    return predictions
      .filter(p => p.class === 'shoe-protector' && p.points && p.points.length >= 3)
      .map(p => {
        const xs = p.points.map(point => point.x);
        const ys = p.points.map(point => point.y);
        return {
          x: (Math.min(...xs) + Math.max(...xs)) / 2,
          y: (Math.min(...ys) + Math.max(...ys)) / 2,
          confidence: p.confidence || 0.5,
          class: p.class
        };
      });
  }
 
  /**
   * Зеркальное отражение центров
   */
  mirrorCenters(centers) {
    return centers.map(center => ({
      ...center,
      x: -center.x // отражение по вертикальной оси
    }));
  }
 
  /**
   * Форматирование быстрого результата
   */
  formatQuickResult(result, fragmentNodes, consensusModel) {
    const matchPercentage = Math.min(result.matchPercentage, 100);
    const confidence = this.calculateConfidence(
      result.matchCount,
      fragmentNodes,
      consensusModel.nodes.length,
      matchPercentage
    );
   
    const isMatch = confidence >= this.matchThreshold &&
                    result.matchCount >= this.minNodesForMatch;
   
    return {
      isMatch,
      confidence: Math.round(confidence * 100) / 100,
      matchCount: result.matchCount,
      matchPercentage: Math.round(matchPercentage * 10) / 10,
      fragmentNodes,
      modelNodes: consensusModel.nodes.length,
      message: this.generateMatchMessage(isMatch, confidence, result.matchCount),
      quick: true
    };
  }
 
  /**
   * Форматирование детального результата
   */
  formatDetailedResult(result, fragmentNodes, consensusModel, isMirrored) {
    const matchPercentage = Math.min(result.matchPercentage, 100);
    const confidence = this.calculateConfidence(
      result.matchCount,
      fragmentNodes,
      consensusModel.nodes.length,
      matchPercentage
    );
   
    const isMatch = confidence >= this.matchThreshold &&
                    result.matchCount >= this.minNodesForMatch;
   
    // Анализ качества совпадений
    const qualityMetrics = this.analyzeMatchQuality(result.matches);
   
    return {
      isMatch,
      confidence: Math.round(confidence * 100) / 100,
      matchCount: result.matchCount,
      matchPercentage: Math.round(matchPercentage * 10) / 10,
      fragmentNodes,
      modelNodes: consensusModel.nodes.length,
      isMirrored,
      quality: qualityMetrics,
      matches: result.matches.slice(0, 10), // первые 10 совпадений
      message: this.generateDetailedMatchMessage(isMatch, confidence, result.matchCount, qualityMetrics),
      quick: false
    };
  }
 
  /**
   * Анализ качества совпадений
   */
  analyzeMatchQuality(matches) {
    if (matches.length === 0) {
      return { avgDistance: 0, avgConfidence: 0, quality: 'poor' };
    }
   
    let totalDistance = 0;
    let totalConfidence = 0;
   
    matches.forEach(match => {
      totalDistance += match.distance;
      totalConfidence += match.confidence;
    });
   
    const avgDistance = totalDistance / matches.length;
    const avgConfidence = totalConfidence / matches.length;
   
    let quality = 'poor';
    if (avgDistance < 15 && avgConfidence > 0.7) quality = 'excellent';
    else if (avgDistance < 25 && avgConfidence > 0.5) quality = 'good';
    else if (avgDistance < 35 && avgConfidence > 0.3) quality = 'fair';
   
    return {
      avgDistance: Math.round(avgDistance * 10) / 10,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      quality
    };
  }
 
  /**
   * Расчёт уверенности совпадения
   */
  calculateConfidence(matchCount, fragmentNodes, modelNodes, matchPercentage) {
    if (matchCount === 0) return 0;
   
    // Вес 1: процент совпадения с моделью
    const coverageScore = matchPercentage / 100;
   
    // Вес 2: отношение совпадений к размеру фрагмента
    const fragmentScore = Math.min(matchCount / fragmentNodes, 1);
   
    // Вес 3: абсолютное количество совпадений
    const absoluteScore = Math.min(matchCount / 10, 1);
   
    // Итоговая уверенность (взвешенная сумма)
    return coverageScore * 0.5 + fragmentScore * 0.3 + absoluteScore * 0.2;
  }
 
  /**
   * Генерация сообщения для быстрого результата
   */
  generateMatchMessage(isMatch, confidence, matchCount) {
    if (matchCount === 0) {
      return '❌ Не обнаружено совпадений';
    }
   
    if (isMatch) {
      if (confidence > 0.85) {
        return `✅ ВЫСОКОЕ СОВПАДЕНИЕ (${matchCount} узлов)`;
      } else if (confidence > 0.7) {
        return `✅ СОВПАДАЕТ (${matchCount} узлов)`;
      } else {
        return `✅ ВОЗМОЖНО СОВПАДЕНИЕ (${matchCount} узлов)`;
      }
    } else {
      if (matchCount >= 2) {
        return `⚠️  ЧАСТИЧНОЕ СОВПАДЕНИЕ (${matchCount} узлов)`;
      } else {
        return `❌ НЕ СОВПАДАЕТ (${matchCount} узел)`;
      }
    }
  }
 
  /**
   * Генерация детального сообщения
   */
  generateDetailedMatchMessage(isMatch, confidence, matchCount, quality) {
    let message = '';
   
    if (isMatch) {
      message += `✅ СОВПАДАЕТ\n`;
    } else {
      message += `❌ НЕ СОВПАДАЕТ\n`;
    }
   
    message += `📊 Уверенность: ${(confidence * 100).toFixed(0)}%\n`;
    message += `🔗 Совпало узлов: ${matchCount}\n`;
   
    if (quality.quality !== 'poor') {
      message += `📏 Средняя ошибка: ${quality.avgDistance}px\n`;
      message += `🎯 Качество совпадений: ${this.getQualityText(quality.quality)}`;
    }
   
    return message;
  }
 
  getQualityText(quality) {
    const texts = {
      excellent: 'ОТЛИЧНО 🏆',
      good: 'ХОРОШО 👍',
      fair: 'УДОВЛЕТВОРИТЕЛЬНО 👌',
      poor: 'НИЗКОЕ 👎'
    };
    return texts[quality] || quality;
  }
 
  /**
   * Результат при отсутствии совпадений
   */
  noMatchResult(reason) {
    return {
      isMatch: false,
      confidence: 0,
      matchCount: 0,
      matchPercentage: 0,
      message: `❌ ${reason}`,
      quick: true
    };
  }
 
  /**
   * Результат при ошибке
   */
  errorResult(error) {
    return {
      isMatch: false,
      confidence: 0,
      matchCount: 0,
      matchPercentage: 0,
      message: `❌ Ошибка: ${error}`,
      error: true,
      quick: true
    };
  }
}

module.exports = { SimilarityEngine };
