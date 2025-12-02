// modules/analysis/normalizer.js
// Нормализация масштаба, ориентации и перспективы

class ImageNormalizer {
  constructor() {
    this.referenceScale = 1.0;
    this.referenceOrientation = 0;
    console.log('🔄 ImageNormalizer инициализирован');
  }
 
  /**
   * Основной метод нормализации
   */
  normalizeToReference(predictions, referenceData = {}) {
    if (!predictions || predictions.length === 0) {
      return predictions;
    }
   
    console.log(`🔄 Нормализую ${predictions.length} предсказаний`);
   
    try {
      // Если нет референса - используем дефолтные значения
      const targetOrientation = referenceData.orientation || this.referenceOrientation;
      const targetScale = referenceData.scale || this.referenceScale;
     
      let result = [...predictions];
     
      // 1. Поворот к единой ориентации (если указана)
      if (targetOrientation !== 0) {
        const currentOrientation = this.calculateDominantOrientation(result);
        const rotationAngle = targetOrientation - currentOrientation;
        if (Math.abs(rotationAngle) > 1) { // поворачиваем только если значительная разница
          result = this.rotatePredictions(result, rotationAngle);
          console.log(`↻ Поворот на ${rotationAngle.toFixed(1)}°`);
        }
      }
     
      // 2. Приведение масштаба (если указан)
      if (targetScale !== 1.0) {
        const currentScale = this.calculateAverageDistance(result);
        if (currentScale > 0) {
          const scaleFactor = targetScale / currentScale;
          if (Math.abs(1 - scaleFactor) > 0.1) { // масштабируем только если значительная разница
            result = this.scalePredictions(result, scaleFactor);
            console.log(`📏 Масштаб ×${scaleFactor.toFixed(2)}`);
          }
        }
      }
     
      // 3. Центрирование
      result = this.centerPredictions(result);
      console.log('✅ Нормализация завершена');
     
      return result;
     
    } catch (error) {
      console.log('❌ Ошибка нормализации:', error.message);
      return predictions; // возвращаем оригинал при ошибке
    }
  }
 
  /**
   * Определение доминирующей ориентации через PCA
   */
  calculateDominantOrientation(predictions) {
    const protectors = predictions.filter(p => p.class === 'shoe-protector');
    if (protectors.length < 3) return 0;
   
    const centers = protectors.map(p => this.getCenter(p.points));
    const centroid = this.calculateCentroid(centers);
   
    // Упрощённый PCA
    let covXX = 0, covYY = 0, covXY = 0;
    centers.forEach(p => {
      const dx = p.x - centroid.x;
      const dy = p.y - centroid.y;
      covXX += dx * dx;
      covYY += dy * dy;
      covXY += dx * dy;
    });
   
    const n = centers.length;
    covXX /= n;
    covYY /= n;
    covXY /= n;
   
    // Угол главной оси
    const angle = 0.5 * Math.atan2(2 * covXY, covXX - covYY) * 180 / Math.PI;
    return angle;
  }
 
  /**
   * Среднее расстояние между центрами протекторов
   */
  calculateAverageDistance(predictions) {
    const protectors = predictions.filter(p => p.class === 'shoe-protector');
    if (protectors.length < 2) return 1.0;
   
    const centers = protectors.map(p => this.getCenter(p.points));
    let totalDist = 0;
    let count = 0;
   
    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < centers.length; j++) {
        totalDist += this.distance(centers[i], centers[j]);
        count++;
      }
    }
   
    return totalDist / count;
  }
 
  /**
   * Поворот предсказаний на заданный угол
   */
  rotatePredictions(predictions, angle) {
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
   
    return predictions.map(pred => ({
      ...pred,
      points: pred.points.map(p => ({
        x: p.x * cos - p.y * sin,
        y: p.x * sin + p.y * cos
      }))
    }));
  }
 
  /**
   * Масштабирование предсказаний
   */
  scalePredictions(predictions, scaleFactor) {
    return predictions.map(pred => ({
      ...pred,
      points: pred.points.map(p => ({
        x: p.x * scaleFactor,
        y: p.y * scaleFactor
      }))
    }));
  }
 
  /**
   * Центрирование предсказаний (центр масс в 0,0)
   */
  centerPredictions(predictions) {
    const allPoints = predictions.flatMap(p => p.points);
    if (allPoints.length === 0) return predictions;
   
    const centroid = this.calculateCentroid(allPoints);
   
    return predictions.map(pred => ({
      ...pred,
      points: pred.points.map(p => ({
        x: p.x - centroid.x,
        y: p.y - centroid.y
      }))
    }));
  }
 
  /**
   * Получение центра bounding box
   */
  getCenter(points) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2
    };
  }
 
  /**
   * Вычисление центра масс массива точек
   */
  calculateCentroid(points) {
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return {
      x: sum.x / points.length,
      y: sum.y / points.length
    };
  }
 
  /**
   * Расстояние между двумя точками
   */
  distance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }
 
  /**
   * Анализ предсказаний для получения референсных данных
   */
  analyzeForReference(predictions) {
    const protectors = predictions.filter(p => p.class === 'shoe-protector');
   
    if (protectors.length < 3) {
      return {
        scale: 1.0,
        orientation: 0,
        canBeReference: false,
        message: 'Мало деталей для референса'
      };
    }
   
    const scale = this.calculateAverageDistance(predictions);
    const orientation = this.calculateDominantOrientation(predictions);
   
    return {
      scale,
      orientation,
      canBeReference: true,
      protectorCount: protectors.length,
      message: `Референс: масштаб=${scale.toFixed(1)}, ориентация=${orientation.toFixed(1)}°`
    };
  }
}

module.exports = { ImageNormalizer };
