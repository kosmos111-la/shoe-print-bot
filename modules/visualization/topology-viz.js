const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

class TopologyVisualizer {
    async createVisualization(imageUrl, predictions, userData) {
        try {
            console.log('🕵️‍♂️ Создаю карту топологии деталей...');
          
            const image = await loadImage(imageUrl);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');

            ctx.drawImage(image, 0, 0);

            // ФИЛЬТРУЕМ: ТОЛЬКО ДЕТАЛИ ПРОТЕКТОРА
            const details = predictions.filter(pred =>
                pred.class === 'shoe-protector'
            );

            console.log(`🕵️‍♂️ Найдено ${details.length} морфологических признаков`);
         
            function getBoundingBox(points) {
                let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
                points.forEach(point => {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                });
                return {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                };
            }

            // Вычисляем центры
            const centers = details.map(pred => {
                const bbox = getBoundingBox(pred.points);
                return {
                    x: bbox.x + bbox.width / 2,
                    y: bbox.y + bbox.height / 2,
                    class: pred.class
                };
            });

            console.log(`🕵️‍♂️ Вычислено ${centers.length} точек анализа`);

            // 1. РИСУЕМ СВЯЗИ МЕЖДУ ЦЕНТРАМИ
            ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
            ctx.lineWidth = 2;
          
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

            // 2. РИСУЕМ ТОЧКИ ЦЕНТРОВ
            centers.forEach(center => {
                ctx.fillStyle = 'red';
                ctx.beginPath();
                ctx.arc(center.x, center.y, 8, 0, Math.PI * 2);
                ctx.fill();

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
                ctx.setLineDash([10, 5]);
              
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
            ctx.strokeText(`🕵️‍♂️ Карта топологии деталей`, 20, 40);
            ctx.fillText(`🕵️‍♂️ Карта топологии деталей`, 20, 40);
          
            ctx.font = '20px Arial';
            ctx.strokeText(`Детали: ${details.length}`, 20, 70);
            ctx.fillText(`Детали: ${details.length}`, 20, 70);      
            ctx.strokeText(`Точки анализа: ${centers.length}`, 20, 95);
            ctx.fillText(`Точки анализа: ${centers.length}`, 20, 95);

            // Сохраняем
            const tempPath = `topology_${Date.now()}.png`;
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(tempPath, buffer);

            console.log('✅ Топологическая визуализация создана успешно!');
            return tempPath;

        } catch (error) {
            console.error('❌ Ошибка создания топологической визуализации:', error);
            return null;
        }
    }
}

module.exports = TopologyVisualizer;
