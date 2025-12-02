// modules/analysis/normalizer.js
// Шаг 2.1: Создаём класс ImageNormalizer
class ImageNormalizer {
  constructor() {
    this.referenceScale = 1.0;
    this.referenceOrientation = 0;
  }
 
  // Основной метод нормализации
  normalizeToReference(predictions, referenceData) {
    // 1. Поворот к единой ориентации
    const rotated = this.alignByOrientation(predictions, referenceData.orientation);
   
    // 2. Приведение масштаба
    const scaled = this.scaleToReference(rotated, referenceData.scale);
   
    // 3. Смещение к центру координат
    const centered = this.centerCoordinates(scaled);
   
    return centered;
  }
 
  // Метод 1: Выравнивание по ориентации
  alignByOrientation(predictions, targetAngle) {
    const currentAngle = this.calculateDominantOrientation(predictions);
    const rotationAngle = targetAngle - currentAngle;
   
    return this.rotatePredictions(predictions, rotationAngle);
  }
 
  // Метод 2: Приведение масштаба
  scaleToReference(predictions, targetScale) {
    const currentScale = this.calculateAverageDistance(predictions);
    const scaleFactor = targetScale / currentScale;
   
    return predictions.map(pred => ({
      ...pred,
      points: pred.points.map(p => ({
        x: p.x * scaleFactor,
        y: p.y * scaleFactor
      }))
    }));
  }
 
  // Метод 3: Центрирование
  centerCoordinates(predictions) {
    const centroid = this.calculateCentroid(predictions);
   
    return predictions.map(pred => ({
      ...pred,
      points: pred.points.map(p => ({
        x: p.x - centroid.x,
        y: p.y - centroid.y
      }))
    }));
  }
 
  // Вспомогательные методы
  calculateDominantOrientation(predictions) {
    // Упрощённый PCA для определения главного направления
    const centers = predictions.map(p => this.getCenter(p.points));
    return this.computePCA(centers).angle;
  }
 
  calculateAverageDistance(predictions) {
    // Среднее расстояние между центрами протекторов
    const centers = predictions.map(p => this.getCenter(p.points));
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
 
  calculateCentroid(predictions) {
    const allPoints = predictions.flatMap(p => p.points);
    const sum = allPoints.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return {
      x: sum.x / allPoints.length,
      y: sum.y / allPoints.length
    };
  }
 
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
 
  computePCA(points) {
    // Упрощённый PCA для 2D точек
    const centroid = this.calculateCentroid([{ points }]);
    let covXX = 0, covYY = 0, covXY = 0;
   
    points.forEach(p => {
      const dx = p.x - centroid.x;
      const dy = p.y - centroid.y;
      covXX += dx * dx;
      covYY += dy * dy;
      covXY += dx * dy;
    });
   
    const angle = 0.5 * Math.atan2(2 * covXY, covXX - covYY) * 180 / Math.PI;
    return { angle };
  }
}

module.exports = { ImageNormalizer };
