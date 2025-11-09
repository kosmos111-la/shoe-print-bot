// modules/visualization/mask-viz.js
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

class MaskStyleVisualization {
    constructor() {
        this.styleName = 'mask';
    }

    async createVisualization(imageUrl, predictions, userData = {}) {
        try {
            console.log('🎨 Создаем визуализацию в стиле MASK...');
           
            // Загружаем оригинальное изображение
            const response = await fetch(imageUrl);
            const buffer = await response.arrayBuffer();
            const image = await loadImage(Buffer.from(buffer));
           
            // Создаем canvas
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');
           
            // 1. Рисуем оригинальное изображение с полупрозрачностью
            ctx.globalAlpha = 0.3;
            ctx.drawImage(image, 0, 0);
            ctx.globalAlpha = 1.0;
           
            // 2. Добавляем темную полупрозрачную маску
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
           
            // 3. Рисуем предсказания черными линиями
            this.drawPredictions(ctx, predictions);
           
            // Сохраняем результат
            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
           
            const outputPath = path.join(tempDir, `mask_viz_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.png`);
            const bufferOut = canvas.toBuffer('image/png');
            fs.writeFileSync(outputPath, bufferOut);
           
            console.log('✅ Mask визуализация создана:', outputPath);
            return outputPath;
           
        } catch (error) {
            console.log('❌ Ошибка mask визуализации:', error);
            return null;
        }
    }

    drawPredictions(ctx, predictions) {
        if (!predictions || predictions.length === 0) return;
       
        predictions.forEach(prediction => {
            const points = prediction.points;
            if (!points || points.length < 3) return;
           
            // Все линии черные, разная толщина и стиль
            ctx.strokeStyle = '#000000';
            ctx.fillStyle = '#000000';
            ctx.lineCap = 'round';
           
            switch(prediction.class) {
                case 'Outline-trail':
                    this.drawOutline(ctx, points);
                    break;
                case 'shoe-protector':
                    this.drawProtector(ctx, points, prediction);
                    break;
                case 'Morphology':
                    this.drawMorphology(ctx, points);
                    break;
                default:
                    this.drawDefault(ctx, points);
            }
        });
    }

    drawOutline(ctx, points) {
        // Толстый пунктир для контура следа
        ctx.setLineDash([15, 10]); // Длина штриха, длина пробела
        ctx.lineWidth = 6;
       
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]); // Сбрасываем пунктир
    }

    drawProtector(ctx, points, prediction) {
        // Черный карандаш для топологии
        ctx.lineWidth = 2;
       
        // Рисуем полигон
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
       
        // Центральная точка (меньше чем в оригинале)
        const center = this.calculateCenter(points);
        ctx.beginPath();
        ctx.arc(center.x, center.y, 3, 0, 2 * Math.PI); // Радиус 3 вместо 5
        ctx.fill();
    }

    drawMorphology(ctx, points) {
        // Тонкий карандаш для морфологии
        ctx.lineWidth = 1;
       
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
    }

    drawDefault(ctx, points) {
        // Стандартное отображение
        ctx.lineWidth = 2;
       
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.stroke();
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
