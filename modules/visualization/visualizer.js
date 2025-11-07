// modules/visualization/visualizer.js
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

/**
* 🎨 КЛАСС ВИЗУАЛИЗАЦИИ
*/
class Visualizer {
   
    /**
     * 📊 ТЕСТОВАЯ ВИЗУАЛИЗАЦИЯ
     */
    static async createAnalysisVisualization(imageUrl, predictions, userData = {}) {
        try {
            const image = await loadImage(imageUrl);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');

            // 1. Рисуем оригинальное фото
            ctx.drawImage(image, 0, 0);

            // 2. ПРОСТОЙ ТЕСТ - красный прямоугольник
            ctx.fillStyle = 'red';
            ctx.fillRect(50, 50, 100, 100);

            // 3. ПРОСТОЙ ТЕСТ - зеленая линия
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(200, 200);
            ctx.lineTo(300, 300);
            ctx.stroke();

            console.log('🎨 Тестовые фигуры нарисованы');

            const vizPath = `viz_${Date.now()}.jpg`;
            const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
            fs.writeFileSync(vizPath, buffer);

            return vizPath;
        } catch (error) {
            console.log('❌ Ошибка визуализации:', error.message);
            return null;
        }
    }

    /**
     * 🦴 ВИЗУАЛИЗАЦИЯ "СКЕЛЕТ СЛЕДА"
     */
    static async createSkeletonVisualization(imageUrl, predictions, userData) {
        try {
            console.log('🕵️♂️ Создаю карту морфологических признаков...');
            return null; // Временно отключаем
        } catch (error) {
            console.error('❌ Ошибка создания скелетной визуализации:', error);
            return null;
        }
    }
}

module.exports = Visualizer;
