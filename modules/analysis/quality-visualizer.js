// modules/analysis/quality-visualizer.js
const { createCanvas, loadImage } = require('canvas');

class QualityVisualizer {
    constructor() {
        this.colors = {
            roboflow: '#FF0000',    // Красный - оригинальный Roboflow
            enhanced: '#00FF00',    // Зеленый - улучшенные
            added: '#0000FF',       // Синий - добавленные
            corrected: '#FFFF00'    // Желтый - исправленные
        };
       
        console.log('🎨 QualityVisualizer инициализирован');
    }

    /**
     * СОЗДАЕМ ВИЗУАЛИЗАЦИЮ КАЧЕСТВА
     */
    async createQualityReport(originalImagePath, rawPredictions, enhancedResult) {
        try {
            // Загружаем оригинальное изображение
            const image = await loadImage(originalImagePath);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');
           
            // 1. Фон - оригинальное фото (полупрозрачное)
            ctx.globalAlpha = 0.3;
            ctx.drawImage(image, 0, 0);
            ctx.globalAlpha = 1.0;
           
            // 2. РИСУЕМ ПРЕДСКАЗАНИЯ
            this.drawPredictions(ctx, rawPredictions, enhancedResult.enhanced);
           
            // 3. ДОБАВЛЯЕМ ЛЕГЕНДУ И СТАТИСТИКУ
            this.drawLegend(ctx, image.width, image.height);
            this.drawStats(ctx, enhancedResult.stats, image.width);
           
            console.log('✅ Визуализация качества создана');
            return canvas;
           
        } catch (error) {
            console.log('❌ Ошибка создания визуализации:', error);
            throw error;
        }
    }

    /**
     * РИСУЕМ ПРЕДСКАЗАНИЯ РАЗНЫМИ ЦВЕТАМИ
     */
    drawPredictions(ctx, rawPredictions, enhancedPredictions) {
        // Находим различия между предсказаниями
        const differences = this.findDifferences(rawPredictions, enhancedPredictions);
       
        // 1. ОРИГИНАЛЬНЫЕ ROBOFLOW (красный)
        ctx.strokeStyle = this.colors.roboflow;
        ctx.lineWidth = 2;
        rawPredictions.forEach(pred => {
            this.drawBoundingBox(ctx, pred.points, 'Roboflow');
        });
       
        // 2. ДОБАВЛЕННЫЕ (синий)
        ctx.strokeStyle = this.colors.added;
        differences.added.forEach(pred => {
            this.drawBoundingBox(ctx, pred.points, 'Added');
            this.drawCross(ctx, this.getCenter(pred.points));
        });
       
        // 3. ИСПРАВЛЕННЫЕ (желтый)
        ctx.strokeStyle = this.colors.corrected;
        differences.corrected.forEach(pred => {
            this.drawDashedBox(ctx, pred.points, 'Corrected');
        });
    }

    /**
     * НАХОДИМ РАЗНИЦЫ МЕЖДУ ПРЕДСКАЗАНИЯМИ
     */
    findDifferences(raw, enhanced) {
        const added = [];
        const corrected = [];
       
        // Ищем добавленные (есть в enhanced, нет в raw)
        enhanced.forEach(enh => {
            const isNew = !raw.some(rawPred =>
                this.areSimilar(enh, rawPred)
            );
           
            if (isNew) {
                added.push(enh);
            }
        });
       
        // Ищем исправленные (изменилась форма)
        enhanced.forEach(enh => {
            const matchingRaw = raw.find(rawPred =>
                this.areSimilar(enh, rawPred) &&
                !this.haveSameShape(enh, rawPred)
            );
           
            if (matchingRaw) {
                corrected.push(enh);
            }
        });
       
        return { added, corrected };
    }

    /**
     * РИСУЕМ BOUNDING BOX
     */
    drawBoundingBox(ctx, points, label = '') {
        if (points.length < 4) return;
       
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
       
        for (let i = 1; i <= 4; i++) {
            const point = points[i % 4];
            ctx.lineTo(point.x, point.y);
        }
       
        ctx.stroke();
       
        // Подпись
        if (label) {
            ctx.fillStyle = ctx.strokeStyle;
            ctx.font = '12px Arial';
            ctx.fillText(label, points[0].x, points[0].y - 5);
        }
    }

    /**
     * РИСУЕМ ПУНКТИРНЫЙ BOUNDING BOX
     */
    drawDashedBox(ctx, points, label = '') {
        if (points.length < 4) return;
       
        ctx.setLineDash([5, 5]);
        this.drawBoundingBox(ctx, points, label);
        ctx.setLineDash([]);
    }

    /**
     * РИСУЕМ КРЕСТИК В ЦЕНТРЕ
     */
    drawCross(ctx, center) {
        const size = 10;
        ctx.beginPath();
        ctx.moveTo(center.x - size, center.y);
        ctx.lineTo(center.x + size, center.y);
        ctx.moveTo(center.x, center.y - size);
        ctx.lineTo(center.x, center.y + size);
        ctx.stroke();
    }

    /**
     * РИСУЕМ ЛЕГЕНДУ
     */
    drawLegend(ctx, width, height) {
        const legendX = 20;
        const legendY = height - 120;
       
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(legendX - 10, legendY - 10, 200, 110);
       
        ctx.fillStyle = '#000000';
        ctx.font = '14px Arial';
        ctx.fillText('📊 ЛЕГЕНДА АНАЛИЗА:', legendX, legendY);
       
        const items = [
            { color: this.colors.roboflow, text: 'Roboflow (оригинал)' },
            { color: this.colors.added, text: 'Добавленные детали' },
            { color: this.colors.corrected, text: 'Исправленные формы' }
        ];
       
        items.forEach((item, i) => {
            ctx.fillStyle = item.color;
            ctx.fillRect(legendX, legendY + 20 + i * 25, 15, 15);
           
            ctx.fillStyle = '#000000';
            ctx.font = '12px Arial';
            ctx.fillText(item.text, legendX + 25, legendY + 32 + i * 25);
        });
    }

    /**
     * РИСУЕМ СТАТИСТИКУ
     */
    drawStats(ctx, stats, width) {
        const statsX = width - 250;
        const statsY = 30;
       
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(statsX - 10, statsY - 10, 240, 120);
       
        ctx.fillStyle = '#000000';
        ctx.font = '16px Arial';
        ctx.fillText('📈 СТАТИСТИКА УЛУЧШЕНИЯ:', statsX, statsY + 15);
       
        ctx.font = '14px Arial';
        const statItems = [
            `➕ Добавлено: ${stats.added || 0}`,
            `✂️ Удалено: ${stats.removed || 0}`,
            `🔧 Исправлено: ${stats.corrected || 0}`,
            `📊 Уверенность: ${stats.confidenceBoost || '0'}%`
        ];
       
        statItems.forEach((text, i) => {
            ctx.fillText(text, statsX, statsY + 45 + i * 20);
        });
    }

    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    areSimilar(predA, predB) {
        // Проверяем близость центров
        const centerA = this.getCenter(predA.points);
        const centerB = this.getCenter(predB.points);
       
        const distance = Math.sqrt(
            Math.pow(centerA.x - centerB.x, 2) +
            Math.pow(centerA.y - centerB.y, 2)
        );
       
        return distance < 30 && predA.class === predB.class;
    }

    haveSameShape(predA, predB) {
        // Упрощенная проверка формы
        const areaA = this.calculateArea(predA.points);
        const areaB = this.calculateArea(predB.points);
       
        return Math.abs(areaA - areaB) / areaA < 0.3; // Разница < 30%
    }

    getCenter(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    calculateArea(points) {
        const width = Math.abs(points[2].x - points[0].x);
        const height = Math.abs(points[2].y - points[0].y);
        return width * height;
    }
}

module.exports = { QualityVisualizer };
