class DetailEnhancer {
    constructor() {
        this.config = {
            mergeDistance: 15,     // пикселей для объединения
            minSize: 10,          // минимальный размер детали
            maxAspectRatio: 5,    // максимальное соотношение сторон
            confidenceThreshold: 0.3 // порог уверенности
        };
       
        console.log('🔧 DetailEnhancer инициализирован');
    }

    /**
     * ОСНОВНОЙ МЕТОД: УЛУЧШАЕМ ПРЕДСКАЗАНИЯ ROBOFLOW
     */
    enhancePredictions(rawPredictions, imageInfo = {}) {
        console.log(`📊 Улучшаю ${rawPredictions.length} предсказаний...`);
       
        // 1. Копируем предсказания
        let enhanced = JSON.parse(JSON.stringify(rawPredictions));
       
        // 2. ФИЛЬТРАЦИЯ МУСОРА
        enhanced = this.filterNoise(enhanced);
       
        // 3. ИСПРАВЛЕНИЕ ФОРМ
        enhanced = this.correctShapes(enhanced);
       
        // 4. ОБЪЕДИНЕНИЕ БЛИЗКИХ
        enhanced = this.mergeCloseBoxes(enhanced);
       
        // 5. ДОБАВЛЕНИЕ ПРОПУЩЕННЫХ
        enhanced = this.addMissingDetails(enhanced, rawPredictions);
       
        console.log(`✅ Улучшено до ${enhanced.length} предсказаний`);
       
        return {
            raw: rawPredictions,
            enhanced: enhanced,
            stats: {
                added: enhanced.length - rawPredictions.length,
                removed: this.removedCount,
                corrected: this.correctedCount,
                confidenceBoost: this.calculateConfidenceBoost(enhanced)
            }
        };
    }

    /**
     * 🚫 ФИЛЬТРАЦИЯ ШУМА И МУСОРА
     */
    filterNoise(predictions) {
        return predictions.filter(pred => {
            // Проверяем размер
            const width = Math.abs(pred.points[2].x - pred.points[0].x);
            const height = Math.abs(pred.points[2].y - pred.points[0].y);
           
            // Слишком маленький
            if (width < this.config.minSize || height < this.config.minSize) {
                return false;
            }
           
            // Слишком вытянутый (вероятно, артефакт)
            const aspectRatio = Math.max(width / height, height / width);
            if (aspectRatio > this.config.maxAspectRatio) {
                return false;
            }
           
            // Слишком низкая уверенность
            if (pred.confidence < this.config.confidenceThreshold) {
                return false;
            }
           
            return true;
        });
    }

    /**
     * 🔷 ИСПРАВЛЕНИЕ КРИВЫХ BOUNDING BOXES
     */
    correctShapes(predictions) {
        return predictions.map(pred => {
            const points = pred.points;
           
            // Если bounding box имеет странную форму
            if (this.isSkewed(points)) {
                this.correctedCount = (this.correctedCount || 0) + 1;
                return this.makeRectangular(pred);
            }
           
            return pred;
        });
    }

    /**
     * 🧩 ОБЪЕДИНЕНИЕ БЛИЗКИХ BOUNDING BOXES
     */
    mergeCloseBoxes(predictions) {
        const merged = [];
        const used = new Set();
       
        for (let i = 0; i < predictions.length; i++) {
            if (used.has(i)) continue;
           
            let current = predictions[i];
            let mergedBox = { ...current };
           
            // Ищем близкие боксы для объединения
            for (let j = i + 1; j < predictions.length; j++) {
                if (used.has(j)) continue;
               
                if (this.areClose(current, predictions[j])) {
                    mergedBox = this.mergeTwoBoxes(mergedBox, predictions[j]);
                    used.add(j);
                }
            }
           
            merged.push(mergedBox);
            used.add(i);
        }
       
        return merged;
    }

    /**
     * 🔍 ДОБАВЛЕНИЕ ПРОПУЩЕННЫХ ДЕТАЛЕЙ ПО ПАТТЕРНУ
     */
    addMissingDetails(enhancedPredictions, originalPredictions) {
        const protectors = enhancedPredictions.filter(p => p.class === 'shoe-protector');
       
        if (protectors.length < 5) return enhancedPredictions; // Недостаточно для анализа паттерна
       
        // Анализируем распределение протекторов
        const pattern = this.analyzePattern(protectors);
       
        // Предсказываем где должны быть протекторы
        const expectedPositions = this.predictMissingPositions(pattern);
       
        // Добавляем пропущенные
        expectedPositions.forEach(position => {
            if (!this.hasProtectorNearby(enhancedPredictions, position)) {
                enhancedPredictions.push(this.createPredictionAt(position));
            }
        });
       
        return enhancedPredictions;
    }

    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    isSkewed(points) {
        const width = Math.abs(points[2].x - points[0].x);
        const height = Math.abs(points[2].y - points[0].y);
        const area = width * height;
       
        // Площадь bounding box должна быть близка к площади четырехугольника
        const quadrilateralArea = this.calculateQuadrilateralArea(points);
        const ratio = Math.abs(area - quadrilateralArea) / area;
       
        return ratio > 0.3; // Если отличается более чем на 30%
    }

    makeRectangular(prediction) {
        const points = prediction.points;
       
        // Находим границы
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        // Создаем правильный прямоугольник
        return {
            ...prediction,
            points: [
                { x: minX, y: minY },
                { x: maxX, y: minY },
                { x: maxX, y: maxY },
                { x: minX, y: maxY }
            ]
        };
    }

    areClose(boxA, boxB) {
        // Центры боксов
        const centerA = this.getCenter(boxA.points);
        const centerB = this.getCenter(boxB.points);
       
        // Расстояние между центрами
        const distance = Math.sqrt(
            Math.pow(centerA.x - centerB.x, 2) +
            Math.pow(centerA.y - centerB.y, 2)
        );
       
        return distance < this.config.mergeDistance;
    }

    mergeTwoBoxes(boxA, boxB) {
        const allPoints = [...boxA.points, ...boxB.points];
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
       
        return {
            class: boxA.class,
            confidence: Math.max(boxA.confidence, boxB.confidence),
            points: [
                { x: Math.min(...xs), y: Math.min(...ys) },
                { x: Math.max(...xs), y: Math.min(...ys) },
                { x: Math.max(...xs), y: Math.max(...ys) },
                { x: Math.min(...xs), y: Math.max(...ys) }
            ]
        };
    }

    analyzePattern(protectors) {
        // Простой анализ паттерна - находим среднее расстояние
        const centers = protectors.map(p => this.getCenter(p.points));
       
        let totalDistance = 0;
        let count = 0;
       
        for (let i = 0; i < centers.length; i++) {
            for (let j = i + 1; j < centers.length; j++) {
                totalDistance += this.distance(centers[i], centers[j]);
                count++;
            }
        }
       
        return {
            averageDistance: totalDistance / count,
            centerDensity: protectors.length / this.calculateAreaCovered(centers),
            arrangement: this.detectArrangement(centers)
        };
    }

    predictMissingPositions(pattern) {
        // Упрощенная версия - возвращаем пустой массив
        // TODO: Реализовать предсказание на основе паттерна
        return [];
    }

    hasProtectorNearby(predictions, position) {
        return predictions.some(pred => {
            if (pred.class !== 'shoe-protector') return false;
            const center = this.getCenter(pred.points);
            return this.distance(center, position) < this.config.mergeDistance * 2;
        });
    }

    createPredictionAt(position) {
        const size = 15; // предположительный размер
        return {
            class: 'shoe-protector',
            confidence: 0.5, // средняя уверенность
            points: [
                { x: position.x - size/2, y: position.y - size/2 },
                { x: position.x + size/2, y: position.y - size/2 },
                { x: position.x + size/2, y: position.y + size/2 },
                { x: position.x - size/2, y: position.y + size/2 }
            ]
        };
    }

    // 📊 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
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

    calculateQuadrilateralArea(points) {
        // Формула площади многоугольника по координатам вершин
        let area = 0;
        const n = points.length;
       
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
       
        return Math.abs(area) / 2;
    }

    calculateAreaCovered(centers) {
        if (centers.length < 2) return 1;
        const xs = centers.map(c => c.x);
        const ys = centers.map(c => c.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        return width * height;
    }

    detectArrangement(centers) {
        // Определяем тип расположения: сетка, линии, случайное
        return 'random'; // TODO: Реализовать
    }

    calculateConfidenceBoost(predictions) {
        // Рассчитываем среднюю уверенность
        if (predictions.length === 0) return 0;
        const sum = predictions.reduce((acc, p) => acc + p.confidence, 0);
        return ((sum / predictions.length) * 100).toFixed(1);
    }
}

module.exports = { DetailEnhancer };
