// modules/utils/visualization.js

/**
* 🎨 Визуализация анализа
*/

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const { calculateBoundingBox } = require('./geometry');

async function createAnalysisVisualization(imageUrl, predictions, userData = {}) {
    if (!imageUrl || !predictions) {
        console.log('❌ Ошибка: нет imageUrl или predictions');
        return null;
    }

    if (predictions.length > 50) {
        console.log(`⚠️ Слишком много объектов (${predictions.length}), ограничиваем визуализацию`);
        predictions = predictions.slice(0, 50);
    }

    try {
        const image = await loadImage(imageUrl);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // Рисуем оригинальное фото
        ctx.drawImage(image, 0, 0);

        // Цвета для разных классов
        const colors = {
            'Outline-trail': 'rgba(148, 0, 211, 0.8)',
            'shoe-protector': 'rgba(64, 224, 208, 0.7)',
            'Heel': 'rgba(0, 0, 255, 0.6)',
            'Toe': 'rgba(30, 144, 255, 0.6)'
        };

        // Рисуем полигоны БЕЗ ПОДПИСЕЙ
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
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, image.height - 80, 300, 70);
       
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`👤 ${userData.username || 'Пользователь'}`, 20, image.height - 55);
        ctx.fillText(`📅 ${new Date().toLocaleString('ru-RU')}`, 20, image.height - 35);
        ctx.fillText(`🔍 Анализатор следов обуви`, 20, image.height - 15);

        const vizPath = `viz_${Date.now()}.jpg`;
        const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
        fs.writeFileSync(vizPath, buffer);

        return vizPath;

    } catch (error) {
        console.log('❌ Ошибка визуализации:', error.message);
        return null;
    }
}

async function createSkeletonVisualization(imageUrl, predictions, userData) {
    try {
        console.log('🕵️‍♂️ Создаю карту морфологических признаков...');
       
        // Загружаем изображение
        const image = await loadImage(imageUrl);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // ВРЕМЕННО: уберем полупрозрачность для теста
        ctx.drawImage(image, 0, 0);

        // ФИЛЬТРУЕМ: ТОЛЬКО ДЕТАЛИ ПРОТЕКТОРА
        const details = predictions.filter(pred =>
            pred.class === 'shoe-protector'
        );

        console.log(`🕵️‍♂️ Найдено ${details.length} морфологических признаков`);

        // Вычисляем центры
        const centers = details.map(pred => {
            const bbox = calculateBoundingBox(pred.points);
            return {
                x: bbox.minX + bbox.width / 2,
                y: bbox.minY + bbox.height / 2,
                class: pred.class
            };
        });

        console.log(`🕵️‍♂️ Вычислено ${centers.length} точек анализа`);

        // 1. РИСУЕМ СВЯЗИ МЕЖДУ ЦЕНТРАМИ
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)'; // Более яркий цвет
        ctx.lineWidth = 2; // Толще линии
       
        const MAX_DISTANCE = Math.min(image.width, image.height) * 0.15;
       
        for (let i = 0; i < centers.length; i++) {
            for (let j = i + 1; j < centers.length; j++) {
                const dist = Math.sqrt(
                    Math.pow(centers[i].x - centers[j].x, 2) +
                    Math.pow(centers[i].y - centers[j].y, 2)
                );
               
                if (dist < MAX_DISTANCE) {
                    ctx.beginPath();
                    ctx.moveTo(centers[i].x, centers[i].y);
                    ctx.lineTo(centers[j].x, centers[j].y);
                    ctx.stroke();
                }
            }
        }

        // 2. РИСУЕМ ТОЧКИ ЦЕНТРОВ (крупные и яркие)
        centers.forEach(center => {
            // Большие красные точки
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(center.x, center.y, 8, 0, Math.PI * 2); // Увеличил радиус
            ctx.fill();

            // Белая обводка
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();
        });

        // 3. КОНТУР СЛЕДА (если есть)
        const outline = predictions.find(pred =>
            pred.class === 'Outline-trail' || pred.class.includes('Outline')
        );
       
        if (outline && outline.points) {
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 5]); // Более заметный пунктир
           
            ctx.beginPath();
            ctx.moveTo(outline.points[0].x, outline.points[0].y);
           
            for (let i = 1; i < outline.points.length; i++) {
                ctx.lineTo(outline.points[i].x, outline.points[i].y);
            }
           
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // 4. ТЕКСТ
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.font = 'bold 30px Arial';
        ctx.strokeText(`🕵️‍♂️ Карта морфологических признаков`, 20, 40);
        ctx.fillText(`🕵️‍♂️ Карта морфологических признаков`, 20, 40);
       
        ctx.font = '20px Arial';
        ctx.strokeText(`Признаки: ${details.length}`, 20, 70);
        ctx.fillText(`Признаки: ${details.length}`, 20, 70);       
        ctx.strokeText(`Точки анализа: ${centers.length}`, 20, 95);
        ctx.fillText(`Точки анализа: ${centers.length}`, 20, 95);

        // Сохраняем
        const tempPath = `skeleton_${Date.now()}.png`;
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(tempPath, buffer);

        console.log('✅ Скелетная визуализация создана успешно!');
        return tempPath;

    } catch (error) {
        console.error('❌ Ошибка создания скелетной визуализации:', error);
        return null;
    }
}

module.exports = {
    createAnalysisVisualization,
    createSkeletonVisualization
};
