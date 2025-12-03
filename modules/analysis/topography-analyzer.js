// modules/analysis/topography-analyzer.js
const { createCanvas, loadImage } = require('canvas');

class TopographyAnalyzer {
    constructor() {
        this.analysisResults = new Map();
        console.log('🗺️ Топографический анализатор инициализирован');
    }

    /**
     * ОСНОВНОЙ МЕТОД АНАЛИЗА
     */
    async analyzeFootprintTopography(imagePath, predictions, imageMetadata = {}) {
        try {
            console.log('🔍 Начинаю топографический анализ...');
           
            const image = await loadImage(imagePath);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            // 🔍 ПРЕДВАРИТЕЛЬНАЯ ОБРАБОТКА ДАННЫХ
            const processedData = this.preprocessPredictions(predictions, image);
           
            // 🎯 ОПРЕДЕЛЕНИЕ ОРИЕНТАЦИИ СЛЕДА (упрощенная версия)
            const orientation = await this.determineFootOrientation(processedData, canvas);
           
            // 📐 ГЕОМЕТРИЧЕСКИЙ АНАЛИЗ
            const geometry = this.analyzeGeometry(processedData, orientation);
           
            const result = {
                orientation,
                geometry,
                metadata: {
                    imageSize: { width: image.width, height: image.height },
                    timestamp: new Date().toISOString(),
                    predictionsCount: predictions.length
                },
                confidence: orientation.confidence
            };

            this.analysisResults.set(imagePath, result);
           
            console.log('✅ Топографический анализ завершен');
            return result;

        } catch (error) {
            console.log('❌ Ошибка топографического анализа:', error);
            // Возвращаем базовый результат вместо ошибки
            return this.getFallbackAnalysis(predictions);
        }
    }

    /**
     * ПРЕДВАРИТЕЛЬНАЯ ОБРАБОТКА ДАННЫХ ROBOFLOW
     */
    preprocessPredictions(predictions, image) {
        const outlines = predictions.filter(p => p.class === 'Outline-trail');
        const protectors = predictions.filter(p => p.class === 'shoe-protector');
       
        return {
            outlines: outlines,
            protectors: protectors,
            allPoints: this.extractAllPoints(predictions),
            imageBounds: { width: image.width, height: image.height }
        };
    }

    /**
     * ОПРЕДЕЛЕНИЕ ОРИЕНТАЦИИ СЛЕДА (упрощенная версия без mathjs)
     */
    async determineFootOrientation(data, canvas) {
        try {
            if (data.allPoints.length < 3) {
                return { angle: 0, confidence: 0, method: 'InsufficientData' };
            }

            // Метод 1: Анализ bounding box
            const bboxAnalysis = this.analyzeWithBoundingBox(data.allPoints);
           
            // Метод 2: Анализ распределения точек
            const distributionAnalysis = this.analyzeWithPointDistribution(data.allPoints);
           
            // Комбинируем результаты
            const angle = (bboxAnalysis.angle + distributionAnalysis.angle) / 2;
            const confidence = (bboxAnalysis.confidence + distributionAnalysis.confidence) / 2;
           
            return {
                angle: this.normalizeAngle(angle),
                confidence: Math.min(confidence, 1),
                method: 'Combined',
                details: {
                    bbox: bboxAnalysis,
                    distribution: distributionAnalysis
                }
            };
           
        } catch (error) {
            console.log('⚠️ Ошибка определения ориентации:', error);
            return { angle: 0, confidence: 0.1, method: 'Fallback' };
        }
    }

    /**
     * Метод bounding box для определения направления
     */
    analyzeWithBoundingBox(points) {
        const bbox = this.calculateBoundingBox(points);
        const aspectRatio = bbox.width / bbox.height;
       
        let angle = 0;
        let confidence = 0;
       
        if (aspectRatio > 1.8) {
            angle = 0; // Горизонтальная ориентация
            confidence = Math.min((aspectRatio - 1) / 2, 0.8);
        } else if (aspectRatio < 0.6) {
            angle = 90; // Вертикальная ориентация 
            confidence = Math.min((1 - aspectRatio) / 2, 0.8);
        } else {
            // Квадратный след - сложно определить
            angle = 45;
            confidence = 0.3;
        }
       
        return {
            angle: angle,
            confidence: confidence,
            method: 'BBox',
            aspectRatio: aspectRatio
        };
    }

    /**
     * Анализ распределения точек
     */
    analyzeWithPointDistribution(points) {
        if (points.length < 5) {
            return { angle: 0, confidence: 0, method: 'Distribution' };
        }
       
        // Вычисляем ковариацию вручную
        const centroid = this.calculateCentroid(points);
       
        let covXX = 0, covYY = 0, covXY = 0;
        points.forEach(p => {
            const dx = p.x - centroid.x;
            const dy = p.y - centroid.y;
            covXX += dx * dx;
            covYY += dy * dy;
            covXY += dx * dy;
        });
       
        covXX /= points.length;
        covYY /= points.length;
        covXY /= points.length;
       
        // Вычисляем угол через собственные векторы (упрощенная версия)
        const angle = 0.5 * Math.atan2(2 * covXY, covXX - covYY) * 180 / Math.PI;
        const confidence = Math.abs(covXX - covYY) / (covXX + covYY + 1e-10);
       
        return {
            angle: this.normalizeAngle(angle),
            confidence: Math.min(confidence * 2, 0.7),
            method: 'Distribution',
            covariance: { xx: covXX, yy: covYY, xy: covXY }
        };
    }

    /**
     * ГЕОМЕТРИЧЕСКИЙ АНАЛИЗ
     */
    analyzeGeometry(data, orientation) {
        const boundingBox = this.calculateBoundingBox(data.allPoints);
        const area = boundingBox.width * boundingBox.height;
       
        return {
            boundingBox,
            aspectRatio: boundingBox.width / boundingBox.height,
            area: area,
            centroid: this.calculateCentroid(data.allPoints),
            footprintType: this.classifyFootprintType(boundingBox),
            sizeEstimation: this.estimateSize(area)
        };
    }

    /**
     * КЛАССИФИКАЦИЯ ТИПА ОБУВИ
     */
    classifyFootprintType(bbox) {
        const aspectRatio = bbox.width / bbox.height;
        if (aspectRatio > 2.2) return "👟 Спортивная обувь";
        if (aspectRatio > 1.8) return "🥾 Уличная обувь";
        if (aspectRatio > 1.4) return "👞 Формальная обувь";
        return "❓ Неопределенный тип";
    }

    /**
     * ОЦЕНКА РАЗМЕРА
     */
    estimateSize(area) {
        // Упрощенная оценка на основе площади
        if (area > 200000) return "45+ (крупный)";
        if (area > 150000) return "42-44 (средний)";
        if (area > 100000) return "39-41 (средний)";
        return "36-38 (маленький)";
    }

    /**
     * 📊 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
     */
    normalizeAngle(angle) {
        return ((angle % 360) + 360) % 360;
    }

    calculateCentroid(points) {
        const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        return { x: sum.x / points.length, y: sum.y / points.length };
    }

    calculateBoundingBox(points) {
        if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }

    extractAllPoints(predictions) {
        return predictions.flatMap(pred => pred.points || []);
    }

    /**
     * РЕЗЕРВНЫЙ АНАЛИЗ ПРИ ОШИБКАХ
     */
    getFallbackAnalysis(predictions) {
        const points = this.extractAllPoints(predictions);
        const bbox = this.calculateBoundingBox(points);
       
        return {
            orientation: { angle: 0, confidence: 0.1, method: 'Fallback' },
            geometry: {
                boundingBox: bbox,
                aspectRatio: bbox.width / bbox.height,
                area: bbox.width * bbox.height,
                centroid: this.calculateCentroid(points),
                footprintType: "❓ Неопределенный",
                sizeEstimation: "❓ Неопределенный"
            },
            confidence: 0.1
        };
    }
}

module.exports = { TopographyAnalyzer };
