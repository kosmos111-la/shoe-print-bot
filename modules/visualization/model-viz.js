// modules/visualization/model-viz.js
// 🏗️ ВИЗУАЛИЗАЦИЯ ИТОГОВОЙ МОДЕЛИ (для продакшена)

const { createCanvas } = require('canvas');
const path = require('path');
const fs = require('fs');

class ModelVisualization {
    constructor() {
        this.styleName = 'model';
        this.version = '2.0';
        console.log('🏗️ ModelVisualization для продакшена создан');
    }

    /**
     * Создаёт визуализацию модели
     * @param {Object} modelData - данные модели
     * @param {Object} options - опции
     * @returns {string} - путь к файлу
     */
    async createVisualization(modelData, options = {}) {
        try {
            console.log('🏗️ Создаю визуализацию итоговой модели...');

            const {
                points = [],
                edges = [],
                currentPhotoPoints = new Set(), // ID точек, совпавших с текущим фото
                width = 1000,
                height = 1000,
                padding = 50
            } = options;

            if (points.length === 0) {
                console.log('⚠️ Нет точек для визуализации');
                return null;
            }

            // Вычисляем границы
            const bounds = this.calculateBounds(points, padding);
            const scale = this.calculateScale(bounds, width, height, padding);

            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // Фон
            ctx.fillStyle = '#1a1a1a'; // Тёмный фон для контраста
            ctx.fillRect(0, 0, width, height);

            // Рисуем рёбра (полупрозрачные)
            this.drawEdges(ctx, edges, points, bounds, scale, width, height);

            // Рисуем точки
            this.drawPoints(ctx, points, currentPhotoPoints, bounds, scale, width, height);

            // Рисуем легенду
            this.drawLegend(ctx, width, height);

            // Сохраняем
            const outputPath = options.outputPath ||
                path.join(this.ensureOutputDir(), `model_${Date.now()}.png`);
           
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(outputPath, buffer);

            console.log(`✅ Модель сохранена: ${outputPath}`);
            return outputPath;

        } catch (error) {
            console.log('❌ Ошибка создания визуализации модели:', error.message);
            return null;
        }
    }

    /**
     * Рисует рёбра графа
     */
    drawEdges(ctx, edges, points, bounds, scale, width, height) {
        if (!edges || edges.length === 0) return;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        for (const edge of edges) {
            const [id1, id2] = edge.split('--');
            const p1 = points.find(p => p.id === id1);
            const p2 = points.find(p => p.id === id2);

            if (!p1 || !p2) continue;

            const x1 = this.projectX(p1.x, bounds, scale, width);
            const y1 = this.projectY(p1.y, bounds, scale, height);
            const x2 = this.projectX(p2.x, bounds, scale, width);
            const y2 = this.projectY(p2.y, bounds, scale, height);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }

    /**
     * Рисует точки с цветами по количеству подтверждений
     */
    drawPoints(ctx, points, currentPhotoPoints, bounds, scale, width, height) {
        for (const point of points) {
            const x = this.projectX(point.x, bounds, scale, width);
            const y = this.projectY(point.y, bounds, scale, height);

            const confirmations = point.confirmationCount || 0;
           
            // Определяем цвет по количеству подтверждений
            let color;
            if (confirmations >= 11) color = '#FF0000'; // Красный
            else if (confirmations >= 5) color = '#FFA500'; // Оранжевый
            else if (confirmations >= 2) color = '#FFD700'; // Жёлтый
            else if (confirmations >= 1) color = '#4169E1'; // Синий
            else color = '#808080'; // Серый

            // Размер точки зависит от подтверждений (больше подтверждений = крупнее)
            const size = 3 + Math.min(confirmations, 7);

            // Рисуем точку
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fill();

            // Если точка совпала с текущим фото - добавляем фиолетовый круг
            if (currentPhotoPoints.has(point.id)) {
                ctx.strokeStyle = '#AA00FF'; // Фиолетовый
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, size + 2, 0, 2 * Math.PI);
                ctx.stroke();
            }

            // Для очень важных точек (11+ подтверждений) добавляем номер
            if (confirmations >= 11 && point.pairNumber) {
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(point.pairNumber.toString(), x, y);
            }
        }
    }

    /**
     * Рисует легенду
     */
    drawLegend(ctx, width, height) {
        const legendX = width - 220;
        const legendY = 20;
        const lineHeight = 22;

        // Полупрозрачный фон для легенды
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(legendX - 10, legendY - 10, 210, 150);

        ctx.font = '12px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('📊 СТАТИСТИКА МОДЕЛИ', legendX, legendY);

        // Цветные точки с описанием
        this.drawLegendItem(ctx, legendX, legendY + lineHeight, '#FF0000', '11+ подтверждений');
        this.drawLegendItem(ctx, legendX, legendY + lineHeight * 2, '#FFA500', '5-10 подтверждений');
        this.drawLegendItem(ctx, legendX, legendY + lineHeight * 3, '#FFD700', '2-5 подтверждений');
        this.drawLegendItem(ctx, legendX, legendY + lineHeight * 4, '#4169E1', '1 подтверждение');
        this.drawLegendItem(ctx, legendX, legendY + lineHeight * 5, '#808080', '0 подтверждений');

        // Фиолетовый круг
        ctx.strokeStyle = '#AA00FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(legendX + 7, legendY + lineHeight * 6 - 3, 6, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.fillText('совпало с текущим фото', legendX + 20, legendY + lineHeight * 6);
    }

    /**
     * Рисует элемент легенды
     */
    drawLegendItem(ctx, x, y, color, text) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + 7, y - 8, 5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.fillText(text, x + 20, y - 5);
    }

    /**
     * Проецирует X координату
     */
    projectX(x, bounds, scale, width) {
        return (x - bounds.minX) * scale + 50;
    }

    /**
     * Проецирует Y координату
     */
    projectY(y, bounds, scale, height) {
        return (y - bounds.minY) * scale + 50;
    }

    /**
     * Вычисляет границы точек
     */
    calculateBounds(points, padding) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const p of points) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }

        // Добавляем отступы
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;

        return { minX, maxX, minY, maxY };
    }

    /**
     * Вычисляет масштаб
     */
    calculateScale(bounds, width, height, padding) {
        const scaleX = (width - padding * 2) / (bounds.maxX - bounds.minX);
        const scaleY = (height - padding * 2) / (bounds.maxY - bounds.minY);
        return Math.min(scaleX, scaleY);
    }

    /**
     * Создаёт выходную директорию
     */
    ensureOutputDir() {
        const dir = path.join(__dirname, '../../data/footprints/visualizations/models');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }
}

module.exports = ModelVisualization;
