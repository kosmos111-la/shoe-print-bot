// modules/visualization/topology-visualizer.js
const { createCanvas, loadImage } = require('canvas');

class TopologyVisualizer {
    constructor() {
        console.log('🕸️ TopologyVisualizer инициализирован');
    }

    async createTopologyVisualization(imageUrl, predictions, outputPath) {
        try {
            const image = await loadImage(imageUrl);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');
           
            // 1. Фон - оригинальное фото (очень прозрачное)
            ctx.globalAlpha = 0.1;
            ctx.drawImage(image, 0, 0);
            ctx.globalAlpha = 1.0;
           
            // 2. РИСУЕМ ТОЧКИ (центры протекторов)
            const protectors = predictions.filter(p => p.class === 'shoe-protector');
            this.drawProtectorPoints(ctx, protectors);
           
            // 3. РИСУЕМ ЛИНИИ СОЕДИНЕНИЯ (топологическая сеть)
            this.drawConnectionLines(ctx, protectors);
           
            // 4. РИСУЕМ КОНТУР СЛЕДА
            const outlines = predictions.filter(p => p.class === 'Outline-trail');
            this.drawFootprintOutline(ctx, outlines);
           
            // 5. ДОБАВЛЯЕМ АНАЛИТИЧЕСКИЕ ЭЛЕМЕНТЫ
            this.drawAnalysisElements(ctx, protectors, outlines);
           
            // Сохраняем
            const fs = require('fs');
            const out = fs.createWriteStream(outputPath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
           
            await new Promise((resolve, reject) => {
                out.on('finish', resolve);
                out.on('error', reject);
            });
           
            console.log('✅ Топологическая визуализация создана');
            return true;
           
        } catch (error) {
            console.log('❌ Ошибка создания топологической визуализации:', error);
            return false;
        }
    }

    drawProtectorPoints(ctx, protectors) {
        protectors.forEach(protector => {
            const center = this.getCenter(protector.points);
           
            // Точка
            ctx.fillStyle = '#00FF00'; // Зеленый
            ctx.beginPath();
            ctx.arc(center.x, center.y, 5, 0, Math.PI * 2);
            ctx.fill();
           
            // Обводка
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }

    drawConnectionLines(ctx, protectors) {
        if (protectors.length < 2) return;
       
        const centers = protectors.map(p => this.getCenter(p.points));
       
        // Соединяем ближайшие точки
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.6)'; // Оранжевый, полупрозрачный
        ctx.lineWidth = 2;
       
        for (let i = 0; i < centers.length; i++) {
            for (let j = i + 1; j < centers.length; j++) {
                const distance = this.getDistance(centers[i], centers[j]);
                if (distance < 100) { // Только близкие точки
                    ctx.beginPath();
                    ctx.moveTo(centers[i].x, centers[i].y);
                    ctx.lineTo(centers[j].x, centers[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    drawFootprintOutline(ctx, outlines) {
        if (outlines.length === 0) return;
       
        // Объединяем все контуры
        const allPoints = outlines.flatMap(o => o.points);
       
        ctx.strokeStyle = 'rgba(0, 0, 255, 0.7)'; // Синий, полупрозрачный
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]); // Пунктирная линия
       
        // Рисуем bounding box контура
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        ctx.beginPath();
        ctx.rect(minX, minY, maxX - minX, maxY - minY);
        ctx.stroke();
       
        ctx.setLineDash([]); // Сбрасываем пунктир
    }

    drawAnalysisElements(ctx, protectors, outlines) {
        // Центр масс всех протекторов
        if (protectors.length > 0) {
            const centers = protectors.map(p => this.getCenter(p.points));
            const centroid = this.getCentroid(centers);
           
            // Крестик в центре масс
            ctx.strokeStyle = '#FF0000'; // Красный
            ctx.lineWidth = 2;
           
            const crossSize = 15;
            ctx.beginPath();
            ctx.moveTo(centroid.x - crossSize, centroid.y);
            ctx.lineTo(centroid.x + crossSize, centroid.y);
            ctx.moveTo(centroid.x, centroid.y - crossSize);
            ctx.lineTo(centroid.x, centroid.y + crossSize);
            ctx.stroke();
        }
       
        // Главные оси распределения
        if (protectors.length > 2) {
            this.drawPrincipalAxes(ctx, protectors);
        }
    }

    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    getCenter(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    getDistance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }

    getCentroid(points) {
        const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        return { x: sum.x / points.length, y: sum.y / points.length };
    }

    drawPrincipalAxes(ctx, protectors) {
        // Упрощенный PCA для визуализации
        const centers = protectors.map(p => this.getCenter(p.points));
        const centroid = this.getCentroid(centers);
       
        // Вычисляем ковариацию
        let covXX = 0, covYY = 0, covXY = 0;
        centers.forEach(p => {
            const dx = p.x - centroid.x;
            const dy = p.y - centroid.y;
            covXX += dx * dx;
            covYY += dy * dy;
            covXY += dx * dy;
        });
       
        covXX /= centers.length;
        covYY /= centers.length;
        covXY /= centers.length;
       
        // Главная ось
        const angle = 0.5 * Math.atan2(2 * covXY, covXX - covYY);
        const length = 100;
       
        ctx.strokeStyle = 'rgba(128, 0, 128, 0.6)'; // Фиолетовый
        ctx.lineWidth = 2;
       
        ctx.beginPath();
        ctx.moveTo(centroid.x - Math.cos(angle) * length, centroid.y - Math.sin(angle) * length);
        ctx.lineTo(centroid.x + Math.cos(angle) * length, centroid.y + Math.sin(angle) * length);
        ctx.stroke();
    }
}

module.exports = { TopologyVisualizer };
