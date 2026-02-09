// modules/footprint/point-tracker.js
// 🔥 АККУМУЛЯЦИОННЫЙ ТРЕКЕР - ХРАНИТ ВСЕ ТОЧКИ ИЗ ВСЕХ СЛЕДОВ

const crypto = require('crypto');

class PointTracker {
  constructor(options = {}) {
    this.points = new Map(); // Хранит ВСЕ точки из ВСЕХ следов
    this.nextId = 1;
   
    this.config = {
      geometricHashPrecision: options.geometricHashPrecision || 5, // Округление углов
      maxNeighborsForPattern: 5, // Сколько соседей использовать для паттерна
      matchDistanceThreshold: 30, // Порог расстояния для совпадения
      minPatternConfirmations: 1, // Минимум подтверждений для надежности
      debug: options.debug || false,
      ...options
    };
   
    console.log('🎯 Аккумуляционный PointTracker создан (хранит все точки из всех следов)');
  }

  // 🔥 ОСНОВНОЙ МЕТОД: Добавить точки из нового следа
  addPointsFromFootprint(points, footprintId, sourceInfo = {}) {
    console.log(`📥 Добавляю ${points.length} точек из следа ${footprintId}`);
   
    const results = {
      added: 0,
      confirmed: 0,
      existing: 0,
      footprintId: footprintId,
      points: []
    };
   
    // Для каждой точки из нового следа
    points.forEach((point, index) => {
      // Создаем геометрический хеш (созвездие)
      const geometricHash = this.createGeometricHash(point, points, index);
      const pointKey = `${geometricHash}_${footprintId}`;
     
      // Ищем похожие точки в существующей базе
      const existingMatch = this.findGeometricMatch(geometricHash, point, footprintId);
     
      if (existingMatch) {
        // Точка уже есть - увеличиваем подтверждения
        this.confirmExistingPoint(existingMatch.id, footprintId, point);
        results.confirmed++;
        results.existing++;
       
        results.points.push({
          status: 'confirmed',
          pointId: existingMatch.id,
          geometricHash: geometricHash,
          confirmations: existingMatch.confirmations
        });
      } else {
        // Новая точка - добавляем в базу
        const newPointId = this.addNewPoint(point, geometricHash, footprintId, sourceInfo);
        results.added++;
       
        results.points.push({
          status: 'new',
          pointId: newPointId,
          geometricHash: geometricHash,
          confirmations: 1
        });
      }
    });
   
    console.log(`📊 Итог: +${results.added} новых, ${results.confirmed} подтверждено, всего точек: ${this.points.size}`);
    return results;
  }

  // 🔥 СОЗДАНИЕ ГЕОМЕТРИЧЕСКОГО ХЕША (созвездия)
  createGeometricHash(centerPoint, allPoints, centerIndex) {
    // Находим ближайших соседей
    const nearestNeighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, 4);
   
    if (nearestNeighbors.length < 2) {
      return `SINGLE_${centerPoint.x.toFixed(0)}_${centerPoint.y.toFixed(0)}`;
    }
   
    // Создаем треугольники с ближайшими соседями
    const triangles = [];
   
    for (let i = 0; i < nearestNeighbors.length; i++) {
      for (let j = i + 1; j < nearestNeighbors.length; j++) {
        const triangle = this.createTriangleHash(
          centerPoint,
          nearestNeighbors[i],
          nearestNeighbors[j]
        );
        triangles.push(triangle);
      }
    }
   
    // Сортируем треугольники для устойчивости
    triangles.sort();
   
    // Создаем хеш из всех треугольников
    const trianglesHash = triangles.join('|').substring(0, 100);
   
    return `TRI_${trianglesHash}`;
  }

  // 🔥 СОЗДАНИЕ ХЕША ТРЕУГОЛЬНИКА
  createTriangleHash(p1, p2, p3) {
    // Вычисляем стороны
    const a = this.distance(p2, p3);
    const b = this.distance(p1, p3);
    const c = this.distance(p1, p2);
   
    // Вычисляем углы (теорема косинусов)
    const angleA = this.cosineLawAngle(b, c, a);
    const angleB = this.cosineLawAngle(a, c, b);
    const angleC = this.cosineLawAngle(a, b, c);
   
    // Округляем для устойчивости
    const roundedAngles = [
      Math.round(angleA / this.config.geometricHashPrecision) * this.config.geometricHashPrecision,
      Math.round(angleB / this.config.geometricHashPrecision) * this.config.geometricHashPrecision,
      Math.round(angleC / this.config.geometricHashPrecision) * this.config.geometricHashPrecision
    ].sort((x, y) => x - y); // Сортируем для инвариантности
   
    // Хеш: углы и относительные расстояния
    const avgDistance = (a + b + c) / 3;
    const normalizedA = Math.round(a / avgDistance * 100);
    const normalizedB = Math.round(b / avgDistance * 100);
    const normalizedC = Math.round(c / avgDistance * 100);
   
    return `${roundedAngles.join('-')}_D${normalizedA}-${normalizedB}-${normalizedC}`;
  }

  // 🔥 ПОИСК ГЕОМЕТРИЧЕСКОГО СОВПАДЕНИЯ
  findGeometricMatch(geometricHash, newPoint, footprintId) {
    // Прямой поиск по хешу
    for (const [pointId, pointData] of this.points) {
      // Пропускаем точки из того же следа
      if (pointData.seenInFootprints && pointData.seenInFootprints.has(footprintId)) {
        continue;
      }
     
      // Сравниваем геометрические хеши
      if (pointData.geometricHash === geometricHash) {
        // Дополнительная проверка по расстоянию
        const distance = this.distance(
          { x: pointData.x, y: pointData.y },
          newPoint
        );
       
        if (distance < this.config.matchDistanceThreshold) {
          return {
            id: pointId,
            geometricHash: pointData.geometricHash,
            confirmations: pointData.seenInFootprints ? pointData.seenInFootprints.size : 1,
            distance: distance
          };
        }
      }
    }
   
    return null;
  }

  // 🔥 ПОДТВЕРЖДЕНИЕ СУЩЕСТВУЮЩЕЙ ТОЧКИ
  confirmExistingPoint(pointId, footprintId, newPoint) {
    const pointData = this.points.get(pointId);
    if (!pointData) return false;
   
    // Добавляем след в список
    if (!pointData.seenInFootprints) {
      pointData.seenInFootprints = new Set();
    }
   
    // Проверяем, не подтверждали ли уже этим следом
    if (pointData.seenInFootprints.has(footprintId)) {
      return false;
    }
   
    pointData.seenInFootprints.add(footprintId);
    pointData.confirmations = (pointData.confirmations || 1) + 1;
    pointData.lastSeen = new Date();
   
    // Уточняем координаты (среднее)
    const weight = 1 / pointData.confirmations;
    pointData.x = pointData.x * (1 - weight) + newPoint.x * weight;
    pointData.y = pointData.y * (1 - weight) + newPoint.y * weight;
   
    return true;
  }

  // 🔥 ДОБАВЛЕНИЕ НОВОЙ ТОЧКИ
  addNewPoint(point, geometricHash, footprintId, sourceInfo) {
    const pointId = `pt_${this.nextId++}`;
   
    const pointData = {
      id: pointId,
      x: point.x,
      y: point.y,
      confidence: point.confidence || 0.5,
      geometricHash: geometricHash,
      seenInFootprints: new Set([footprintId]),
      confirmations: 1,
      firstSeen: new Date(),
      lastSeen: new Date(),
      source: sourceInfo,
      originalCoordinates: { x: point.x, y: point.y }
    };
   
    this.points.set(pointId, pointData);
   
    if (this.config.debug) {
      console.log(`✅ Новая точка ${pointId}: ${geometricHash.substring(0, 30)}...`);
    }
   
    return pointId;
  }

  // 🔥 ПОЛУЧИТЬ ВСЕ ТОЧКИ ДЛЯ ВИЗУАЛИЗАЦИИ
  getAllPointsForVisualization() {
    const points = [];
   
    for (const [pointId, pointData] of this.points) {
      points.push({
        id: pointId,
        x: pointData.x,
        y: pointData.y,
        confirmations: pointData.confirmations || 1,
        confidence: pointData.confidence || 0.5,
        seenInFootprints: pointData.seenInFootprints ?
          Array.from(pointData.seenInFootprints) : [],
        geometricHash: pointData.geometricHash,
        firstSeen: pointData.firstSeen,
        lastSeen: pointData.lastSeen
      });
    }
   
    // Сортируем по количеству подтверждений
    points.sort((a, b) => b.confirmations - a.confirmations);
   
    return points;
  }

  // 🔥 СТАТИСТИКА
  getStats() {
    let totalPoints = 0;
    let confirmed1 = 0, confirmed2 = 0, confirmed3 = 0;
    let totalConfirmations = 0;
   
    for (const [, pointData] of this.points) {
      totalPoints++;
      const confirmations = pointData.confirmations || 1;
      totalConfirmations += confirmations;
     
      if (confirmations >= 3) confirmed3++;
      else if (confirmations >= 2) confirmed2++;
      else confirmed1++;
    }
   
    return {
      totalPoints: totalPoints,
      confirmed3: confirmed3,
      confirmed2: confirmed2,
      confirmed1: confirmed1,
      avgConfirmations: totalPoints > 0 ? totalConfirmations / totalPoints : 0,
      uniqueFootprints: this.getUniqueFootprintCount()
    };
  }
 
  getUniqueFootprintCount() {
    const footprintSet = new Set();
    for (const pointData of this.points.values()) {
      if (pointData.seenInFootprints) {
        pointData.seenInFootprints.forEach(footprintId => {
          footprintSet.add(footprintId);
        });
      }
    }
    return footprintSet.size;
  }

  // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
 
  cosineLawAngle(side1, side2, opposite) {
    const cos = (side1 * side1 + side2 * side2 - opposite * opposite) / (2 * side1 * side2);
    const clamped = Math.max(-1, Math.min(1, cos));
    return Math.acos(clamped) * 180 / Math.PI;
  }
 
  findNearestNeighbors(centerPoint, allPoints, centerIndex, count) {
    const distances = [];
   
    for (let i = 0; i < allPoints.length; i++) {
      if (i === centerIndex) continue;
     
      const distance = this.distance(centerPoint, allPoints[i]);
      distances.push({
        point: allPoints[i],
        distance: distance,
        index: i
      });
    }
   
    distances.sort((a, b) => a.distance - b.distance);
    return distances.slice(0, count).map(d => d.point);
  }

  // 🔥 ДЛЯ СОВМЕСТИМОСТИ
  toJSON() {
    const pointsArray = Array.from(this.points.entries()).map(([id, point]) => {
      const serializedPoint = { ...point };
      if (serializedPoint.seenInFootprints) {
        serializedPoint.seenInFootprints = Array.from(serializedPoint.seenInFootprints);
      }
      return [id, serializedPoint];
    });
   
    return {
      points: pointsArray,
      nextId: this.nextId,
      config: this.config,
      _version: '5.0-accumulative',
      _savedAt: new Date().toISOString()
    };
  }
 
  static fromJSON(data) {
    const tracker = new PointTracker(data.config || {});
   
    if (Array.isArray(data.points)) {
      data.points.forEach(([id, pointData]) => {
        if (Array.isArray(pointData.seenInFootprints)) {
          pointData.seenInFootprints = new Set(pointData.seenInFootprints);
        }
        tracker.points.set(id, pointData);
      });
    }
   
    tracker.nextId = data.nextId || 1;
   
    console.log(`✅ Загружен аккумуляционный PointTracker, ${tracker.points.size} точек`);
    return tracker;
  }
}

module.exports = PointTracker;
