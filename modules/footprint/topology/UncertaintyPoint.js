// modules/footprint/topology/UncertaintyPoint.js
// 🎯 ТОЧКА С ОБЛАСТЬЮ НЕОПРЕДЕЛЁННОСТИ (GPS-подобная)

class UncertaintyPoint {
    constructor(id, x, y, confidence = 0.5, baseRadius = 2.0) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.confidence = confidence;
       
        // 🔥 РАДИУС НЕОПРЕДЕЛЁННОСТИ (обратно пропорционален уверенности)
        this.radius = baseRadius * (1.5 - confidence);
       
        // Ограничиваем минимальный и максимальный радиус
        this.radius = Math.min(Math.max(this.radius, 1.0), 8.0);
       
        // История объединений
        this.mergedFrom = [];
        this.mergeCount = 0;
        this.lastMergeTime = Date.now();
    }
   
    /**
     * Проверяет, пересекаются ли две области
     */
    intersects(other, overlapThreshold = 0.5) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        const sumRadii = this.radius + other.radius;
       
        // Пересекаются, если расстояние меньше суммы радиусов
        // и перекрытие составляет > overlapThreshold от меньшего радиуса
        if (distance < sumRadii) {
            const overlap = sumRadii - distance;
            const minRadius = Math.min(this.radius, other.radius);
            return overlap > minRadius * overlapThreshold;
        }
        return false;
    }
   
    /**
     * Объединяет две области (слияние)
     */
    mergeWith(other) {
        // Новый центр — взвешенное среднее
        const totalWeight = this.confidence + other.confidence;
        const newX = (this.x * this.confidence + other.x * other.confidence) / totalWeight;
        const newY = (this.y * this.confidence + other.y * other.confidence) / totalWeight;
       
        // Новый радиус — огибающая область
        const dxToNew = Math.abs(this.x - newX);
        const dyToNew = Math.abs(this.y - newY);
        const distToNew = Math.sqrt(dxToNew*dxToNew + dyToNew*dyToNew);
       
        const otherDxToNew = Math.abs(other.x - newX);
        const otherDyToNew = Math.abs(other.y - newY);
        const otherDistToNew = Math.sqrt(otherDxToNew*otherDxToNew + otherDyToNew*otherDyToNew);
       
        // Новый радиус покрывает обе исходные точки
        const newRadius = Math.max(
            distToNew + this.radius,
            otherDistToNew + other.radius
        );
       
        // Обновляем
        this.x = newX;
        this.y = newY;
        this.radius = Math.min(newRadius, 12.0); // максимум 12px
        this.confidence = Math.min(0.95, (this.confidence + other.confidence) / 2);
       
        // Сохраняем историю
        this.mergedFrom.push(other.id);
        this.mergeCount++;
        this.lastMergeTime = Date.now();
       
        return true;
    }
   
    /**
     * Обновляет позицию с учётом нового наблюдения
     */
    updateWithObservation(newX, newY, newConfidence) {
        const oldX = this.x;
        const oldY = this.y;
       
        // Взвешенное среднее (новое наблюдение имеет меньший вес, если уверенность низкая)
        const weight = newConfidence * 0.7 + 0.3;
        this.x = this.x * (1 - weight) + newX * weight;
        this.y = this.y * (1 - weight) + newY * weight;
       
        // Обновляем уверенность
        this.confidence = Math.min(0.95, (this.confidence + newConfidence) / 2);
       
        // Пересчитываем радиус
        const displacement = Math.sqrt(
            Math.pow(this.x - oldX, 2) + Math.pow(this.y - oldY, 2)
        );
        this.radius = Math.min(
            this.radius * 0.9 + displacement * 0.5, // смещение увеличивает неопределённость
            12.0
        );
    }
   
    /**
     * Возвращает точку для отображения (центр)
     */
    getDisplayPoint() {
        return { x: this.x, y: this.y, radius: this.radius };
    }
   
    /**
     * Сериализация
     */
    serialize() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            radius: this.radius,
            confidence: this.confidence,
            mergeCount: this.mergeCount,
            mergedFrom: this.mergedFrom,
            lastMergeTime: this.lastMergeTime
        };
    }
   
    static deserialize(data) {
        const point = new UncertaintyPoint(data.id, data.x, data.y, data.confidence);
        point.radius = data.radius;
        point.mergeCount = data.mergeCount || 0;
        point.mergedFrom = data.mergedFrom || [];
        point.lastMergeTime = data.lastMergeTime || Date.now();
        return point;
    }
}

/**
* Менеджер облачных точек (управляет слиянием и предотвращает пересечения)
*/
class UncertaintyPointManager {
    constructor(options = {}) {
        this.points = new Map(); // id -> UncertaintyPoint
        this.overlapThreshold = options.overlapThreshold || 0.5; // 50% перекрытия
        this.maxRadius = options.maxRadius || 12.0;
        this.debug = options.debug || false;
       
        console.log(`🎯 UncertaintyPointManager создан`);
        console.log(`   • Порог перекрытия: ${this.overlapThreshold * 100}%`);
        console.log(`   • Макс. радиус: ${this.maxRadius}px`);
    }
   
    /**
     * Добавляет новое наблюдение (или обновляет существующее)
     */
    addObservation(id, x, y, confidence = 0.5) {
        let point = this.points.get(id);
       
        if (!point) {
            // Новая точка
            point = new UncertaintyPoint(id, x, y, confidence, 2.0);
            this.points.set(id, point);
           
            if (this.debug) {
                console.log(`   🆕 Новая точка ${id.substring(0,12)}: (${x.toFixed(1)}, ${y.toFixed(1)}), радиус ${point.radius.toFixed(1)}px`);
            }
        } else {
            // Обновляем существующую
            point.updateWithObservation(x, y, confidence);
           
            if (this.debug) {
                console.log(`   🔄 Обновлена точка ${id.substring(0,12)}: (${x.toFixed(1)}, ${y.toFixed(1)}), радиус ${point.radius.toFixed(1)}px`);
            }
        }
       
        // После добавления/обновления проверяем пересечения
        this.resolveOverlaps();
       
        return point;
    }
   
    /**
     * Разрешает пересекающиеся области (слияние)
     */
    resolveOverlaps() {
        let merged = true;
        let iterations = 0;
        const maxIterations = 10;
       
        while (merged && iterations < maxIterations) {
            merged = false;
            iterations++;
           
            const pointsArray = Array.from(this.points.values());
           
            for (let i = 0; i < pointsArray.length; i++) {
                for (let j = i + 1; j < pointsArray.length; j++) {
                    const p1 = pointsArray[i];
                    const p2 = pointsArray[j];
                   
                    if (p1.intersects(p2, this.overlapThreshold)) {
                        // Сливаем p2 в p1
                        p1.mergeWith(p2);
                        this.points.delete(p2.id);
                       
                        if (this.debug) {
                            console.log(`   🔗 Слияние: ${p2.id.substring(0,12)} → ${p1.id.substring(0,12)} (новый радиус ${p1.radius.toFixed(1)}px)`);
                        }
                       
                        merged = true;
                        break;
                    }
                }
                if (merged) break;
            }
        }
       
        if (iterations > 1 && this.debug) {
            console.log(`   ✅ Разрешение пересечений: ${iterations} итераций, осталось ${this.points.size} точек`);
        }
    }
   
    /**
     * Получает точку для отображения (с центром и радиусом)
     */
    getPoint(id) {
        return this.points.get(id);
    }
   
    /**
     * Получает все точки для визуализации
     */
    getAllPoints() {
        const result = [];
        for (const point of this.points.values()) {
            result.push(point.getDisplayPoint());
        }
        return result;
    }
   
    /**
     * Конвертирует в обычные точки (для обратной совместимости)
     */
    toSimplePoints() {
        const points = [];
        for (const point of this.points.values()) {
            points.push({
                id: point.id,
                x: point.x,
                y: point.y,
                confidence: point.confidence,
                radius: point.radius,
                mergeCount: point.mergeCount
            });
        }
        return points;
    }
   
    /**
     * Статистика
     */
    getStats() {
        let totalRadius = 0;
        let totalMerges = 0;
       
        for (const point of this.points.values()) {
            totalRadius += point.radius;
            totalMerges += point.mergeCount;
        }
       
        return {
            totalPoints: this.points.size,
            avgRadius: this.points.size > 0 ? totalRadius / this.points.size : 0,
            totalMerges: totalMerges,
            maxRadius: Math.max(...Array.from(this.points.values()).map(p => p.radius), 0),
            minRadius: Math.min(...Array.from(this.points.values()).map(p => p.radius), Infinity)
        };
    }
   
    clear() {
        this.points.clear();
    }
}

module.exports = { UncertaintyPoint, UncertaintyPointManager };
