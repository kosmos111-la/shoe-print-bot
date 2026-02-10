// modules/footprint/point-tracker.js
// 🔥 УПРОЩЕННЫЙ - ТОЛЬКО ДЛЯ СОВМЕСТИМОСТИ

class PointTracker {
    constructor(options = {}) {
        this.points = new Map();
        this.nextId = 1;
        this.config = {
            debug: options.debug || false,
            maxConfirmations: options.maxConfirmations || 10
        };
       
        console.log('🎯 Упрощенный PointTracker создан (только для совместимости)');
    }

    // 🔥 ПРОСТАЯ ОБРАБОТКА (для совместимости)
    processNewPoints(newPoints, sourceInfo = {}) {
        console.log(`🎯 [Совместимость] Обработка ${newPoints.length} точек (упрощенная)`);
       
        const results = {
            added: 0,
            updated: 0,
            merged: 0,
            skipped: 0
        };

        // 🔥 В ФОТО-ОРИЕНТИРОВАННОЙ МОДЕЛИ ЭТОТ КЛАСС НЕ ИСПОЛЬЗУЕТСЯ ДЛЯ СРАВНЕНИЯ
        // Оставляем для совместимости со старым кодом
       
        newPoints.forEach(point => {
            const pointId = `pt_${this.nextId++}`;
           
            this.points.set(pointId, {
                id: pointId,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                confirmedCount: 1,
                lastSeen: new Date(),
                source: sourceInfo.photoId || 'unknown',
                note: '⚠️ ТОЧКА ИЗ УПРОЩЕННОГО TRACKER (не для сравнения)'
            });
           
            results.added++;
        });

        console.log(`✅ Добавлено ${results.added} точек (только для совместимости)`);
        return results;
    }

    // 🔥 ПРОСТЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ
    getStats() {
        return {
            totalPoints: this.points.size,
            avgConfirmations: 1,
            highConfidencePoints: 0,
            note: 'Упрощенный трекер - не для топологического сравнения'
        };
    }

    toJSON() {
        const pointsArray = Array.from(this.points.entries());
       
        return {
            points: pointsArray,
            nextId: this.nextId,
            _version: 'simple_v1.0_compat',
            _note: 'Точки только для совместимости'
        };
    }

    static fromJSON(data) {
        const tracker = new PointTracker();
       
        if (Array.isArray(data.points)) {
            data.points.forEach(([id, pointData]) => {
                tracker.points.set(id, pointData);
            });
        }
       
        tracker.nextId = data.nextId || 1;
        return tracker;
    }
}

module.exports = PointTracker;
