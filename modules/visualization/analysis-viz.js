// modules/visualization/analysis-viz.js
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

class AnalysisVisualizer {
    async createVisualization(imageUrl, predictions, userData = {}, outputPath = null) {
    if (!imageUrl || !predictions) return null;

    try {
        const image = await loadImage(imageUrl);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // Рисуем оригинальное фото
        ctx.drawImage(image, 0, 0);

        // Цвета из конфига
        const colors = {
            'Outline-trail': 'rgba(148, 0, 211, 0.8)',
            'shoe-protector': 'rgba(64, 224, 208, 0.7)',
            'Heel': 'rgba(0, 0, 255, 0.6)',
            'Toe': 'rgba(30, 144, 255, 0.6)'
        };

        // Рисуем полигоны
        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 2) {
                const color = colors[pred.class] || 'rgba(255, 255, 255, 0.7)';

                ctx.strokeStyle = color;
                ctx.lineWidth = pred.class === 'Outline-trail' ? 4 : 2;
                ctx.beginPath();

                ctx.moveTo(pred.points[0].x, pred.points[0].y);
                for (let i = 1; i < pred.points.length; i++) {
                    ctx.lineTo(pred.points[i].x, pred.points[i].y);
                }
                ctx.closePath();
                ctx.stroke();
            }
        });

        // Водяной знак
        this._addWatermark(ctx, image.width, image.height, userData);

        // 🔄 ИЗМЕНЕНИЕ: используем переданный путь или создаем свой
        const vizPath = outputPath || `viz_${Date.now()}.jpg`;
        const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
        fs.writeFileSync(vizPath, buffer);

        console.log(`✅ Визуализация сохранена: ${vizPath}`);
        return vizPath;

    } catch (error) {
        console.log('❌ Ошибка визуализации:', error.message);
        return null;
    }
}
   
    _addWatermark(ctx, width, height, userData) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, height - 80, 300, 70);
      
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`👤 ${userData.username || 'Пользователь'}`, 20, height - 55);
        ctx.fillText(`📅 ${new Date().toLocaleString('ru-RU')}`, 20, height - 35);
        ctx.fillText(`🔍 Анализатор следов обуви`, 20, height - 15);
    }
}

module.exports = AnalysisVisualizer;
