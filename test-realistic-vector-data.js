// test-realistic-vector-data.js
// 🎯 РЕАЛИСТИЧНЫЕ ВЕКТОРНЫЕ ДАННЫЕ ДЛЯ ТЕСТИРОВАНИЯ

class RealisticVectorData {
    /**
     * СОЗДАТЬ РЕАЛИСТИЧНЫЙ СЛЕД (векторные координаты)
     * Имитирует данные от системы детекции с фото
     */
    static createRealisticShoePrint(options = {}) {
        const {
            pointCount = 12,     // Количество точек (обычно 8-15)
            centerX = 500,       // Центр в системе координат
            centerY = 500,
            width = 200,         // Ширина следа (пиксели)
            height = 300,        // Высота следа (пиксели)
            noiseLevel = 3,      // Уровень шума (пиксели)
            confidence = 0.8     // Уверенность детекции
        } = options;

        // 🔥 РЕАЛИСТИЧНАЯ ФОРМА: подошва обуви (не идеальный овал!)
        const points = [];
       
        // Нерегулярные углы (как на реальном следе)
        const angles = [];
        let currentAngle = 0;
        for (let i = 0; i < pointCount; i++) {
            // Неравномерное распределение
            const angleStep = 360 / pointCount + (Math.random() - 0.5) * 20;
            currentAngle += angleStep;
            angles.push(currentAngle % 360);
        }
       
        // Создаем точки с шумом
        for (let i = 0; i < pointCount; i++) {
            const angleRad = angles[i] * Math.PI / 180;
           
            // Эллипс с вариациями (как реальный след)
            const radiusX = width / 2 * (0.8 + Math.random() * 0.4);
            const radiusY = height / 2 * (0.7 + Math.random() * 0.6);
           
            // Базовые координаты
            let x = centerX + radiusX * Math.cos(angleRad);
            let y = centerY + radiusY * Math.sin(angleRad);
           
            // Добавляем шум (как при детекции)
            x += (Math.random() - 0.5) * 2 * noiseLevel;
            y += (Math.random() - 0.5) * 2 * noiseLevel;
           
            // Разная уверенность для разных точек
            const pointConfidence = confidence * (0.7 + Math.random() * 0.3);
           
            points.push({
                x: Math.round(x * 10) / 10, // Округляем до 0.1px
                y: Math.round(y * 10) / 10,
                confidence: Math.min(1, pointConfidence),
                id: `pt_${Date.now()}_${i}`,
                originalId: `pt_${i}`, // Для тестов - одинаковый порядок
                source: 'detection_system'
            });
        }
       
        // 🔥 ВАЖНО: НЕ сортируем по углам! Порядок как пришел от детектора
        // (в реальности точки могут приходить в произвольном порядке)
       
        return points;
    }
   
    /**
     * СОЗДАТЬ ЧАСТИЧНЫЙ СЛЕД (как при неполной видимости)
     */
    static createPartialShoePrint(fullPoints, missingPercent = 0.25) {
        const missingCount = Math.floor(fullPoints.length * missingPercent);
        const indicesToRemove = new Set();
       
        // Случайные точки для удаления
        while (indicesToRemove.size < missingCount) {
            indicesToRemove.add(Math.floor(Math.random() * fullPoints.length));
        }
       
        return fullPoints
            .filter((_, idx) => !indicesToRemove.has(idx))
            .map((point, newIdx) => ({
                ...point,
                id: `partial_${Date.now()}_${newIdx}`, // Новый ID
                originalId: point.originalId, // Сохраняем originalId для сравнения
                isPartial: true
            }));
    }
   
    /**
     * ДОБАВИТЬ ПОВОРОТ (в векторных координатах)
     */
    static rotatePoints(points, angleDegrees, centerX = 500, centerY = 500) {
        const angleRad = angleDegrees * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        return points.map((point, idx) => {
            // Смещаем к центру, поворачиваем, возвращаем
            const dx = point.x - centerX;
            const dy = point.y - centerY;
           
            const x = centerX + dx * cosA - dy * sinA;
            const y = centerY + dx * sinA + dy * cosA;
           
            return {
                ...point,
                x: Math.round(x * 10) / 10,
                y: Math.round(y * 10) / 10,
                id: `${point.id}_R${angleDegrees}`,
                rotation: angleDegrees
            };
        });
    }
   
    /**
     * ДОБАВИТЬ СМЕЩЕНИЕ (как при фото с другого ракурса)
     */
    static translatePoints(points, offsetX, offsetY) {
        return points.map(point => ({
            ...point,
            x: point.x + offsetX,
            y: point.y + offsetY,
            id: `${point.id}_T${offsetX}_${offsetY}`
        }));
    }
   
    /**
     * ДОБАВИТЬ ШУМ (имитация разных условий съемки)
     */
    static addNoise(points, noiseLevel = 5) {
        return points.map(point => ({
            ...point,
            x: point.x + (Math.random() - 0.5) * 2 * noiseLevel,
            y: point.y + (Math.random() - 0.5) * 2 * noiseLevel,
            confidence: point.confidence * (0.9 + Math.random() * 0.1), // Уверенность меняется
            id: `${point.id}_N${noiseLevel}`
        }));
    }
   
    /**
     * ИЗМЕНИТЬ МАСШТАБ (векторное масштабирование)
     */
    static scalePoints(points, scaleX, scaleY, centerX = 500, centerY = 500) {
        return points.map(point => {
            const dx = point.x - centerX;
            const dy = point.y - centerY;
           
            return {
                ...point,
                x: centerX + dx * scaleX,
                y: centerY + dy * scaleY,
                id: `${point.id}_S${scaleX.toFixed(1)}_${scaleY.toFixed(1)}`
            };
        });
    }
}

module.exports = RealisticVectorData;
