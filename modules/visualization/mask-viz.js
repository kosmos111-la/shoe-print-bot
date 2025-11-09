// modules/visualization/mask-viz.js
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

class MaskStyleVisualization {
    constructor() {
        this.styleName = 'mask';
        console.log('✅ MaskStyleVisualization создан');
    }

    async createVisualization(imageUrl, predictions, userData = {}) {
        try {
            console.log('🎨 Создаем MASK визуализацию...');
           
            // 🔒 ПРОВЕРКА ВХОДНЫХ ДАННЫХ
            if (!imageUrl) {
                console.log('❌ Нет imageUrl');
                return null;
            }

            if (!predictions || !Array.isArray(predictions)) {
                console.log('❌ Неверные predictions');
                return null;
            }

            // Загружаем изображение с таймаутом
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10 сек таймаут
           
            try {
                const response = await fetch(imageUrl, { signal: controller.signal });
                clearTimeout(timeout);
               
                if (!response.ok) {
                    console.log(`❌ HTTP ошибка: ${response.status}`);
                    return null;
                }
               
                const buffer = await response.arrayBuffer();
                const image = await loadImage(Buffer.from(buffer));
               
                // Создаем canvas
                const canvas = createCanvas(image.width, image.height);
                const ctx = canvas.getContext('2d');
               
                // 1. Оригинальное изображение с полупрозрачностью
                ctx.globalAlpha = 0.3;
                ctx.drawImage(image, 0, 0);
                ctx.globalAlpha = 1.0;
               
                // 2. Темная полупрозрачная маска
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
               
                // 3. Рисуем предсказания черными линиями
                this.drawPredictions(ctx, predictions);
               
                // Сохраняем с уникальным именем
                const tempDir = this.ensureTempDir();
                const outputPath = path.join(tempDir, `mask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`);
               
                const bufferOut = canvas.toBuffer('image/png');
                fs.writeFileSync(outputPath, bufferOut);
               
                console.log('✅ Mask визуализация создана:', outputPath);
                return outputPath;
               
            } catch (fetchError) {
                clearTimeout(timeout);
                if (fetchError.name === 'AbortError') {
                    console.log('❌ Таймаут загрузки изображения');
                } else {
                    throw fetchError;
                }
            }
           
            return null;
           
        } catch (error) {
            console.log('❌ Критическая ошибка в createVisualization:', error.message);
            return null;
        }
    }

    ensureTempDir() {
        const tempDir = path.join(__dirname, '../../temp');
        try {
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            return tempDir;
        } catch (error) {
            console.log('❌ Ошибка создания temp dir:', error.message);
            // Fallback - текущая директория
            return __dirname;
        }
    }

    drawPredictions(ctx, predictions) {
        try {
            const validPredictions = predictions.filter(pred =>
                pred && pred.points && Array.isArray(pred.points) && pred.points.length >= 3
            );
           
            if (validPredictions.length === 0) {
                console.log('⚠️ Нет валидных predictions для отрисовки');
                return;
            }
           
            validPredictions.forEach(prediction => {
                this.drawSinglePrediction(ctx, prediction);
            });
           
        } catch (error) {
            console.log('❌ Ошибка в drawPredictions:', error.message);
        }
    }

    drawSinglePrediction(ctx, prediction) {
        try {
            const points = prediction.points;
            const className = prediction.class || 'unknown';
           
            ctx.strokeStyle = '#000000';
            ctx.fillStyle = '#000000';
            ctx.lineCap = 'round';
           
            switch(className) {
                case 'Outline-trail':
                    this.drawOutline(ctx, points);
                    break;
                case 'shoe-protector':
                    this.drawProtector(ctx, points);
                    break;
                case 'Morphology':
                    this.drawMorphology(ctx, points);
                    break;
                default:
                    this.drawDefault(ctx, points);
            }
        } catch (error) {
            console.log('❌ Ошибка отрисовки prediction:', error.message);
        }
    }

    drawOutline(ctx, points) {
        ctx.setLineDash([15, 10]);
        ctx.lineWidth = 6;
        this.drawPolygon(ctx, points);
        ctx.setLineDash([]);
    }

    drawProtector(ctx, points) {
        ctx.lineWidth = 2;
        this.drawPolygon(ctx, points);
        this.drawCenterPoint(ctx, points, 3);
    }

    drawMorphology(ctx, points) {
        ctx.lineWidth = 1;
        this.drawPolygon(ctx, points);
    }

    drawDefault(ctx, points) {
        ctx.lineWidth = 2;
        this.drawPolygon(ctx, points);
    }

    drawPolygon(ctx, points) {
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
    }

    drawCenterPoint(ctx, points, radius = 3) {
        try {
            const center = this.calculateCenter(points);
            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
            ctx.fill();
        } catch (error) {
            console.log('❌ Ошибка рисования центральной точки');
        }
    }

    calculateCenter(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }
}

module.exports = MaskStyleVisualization;
