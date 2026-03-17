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
     * @param {Object} options - параметры визуализации
     * @returns {string} - путь к файлу
     */
    async createVisualization(options = {}) {
        try {
            console.log('🏗️ Создаю визуализацию итоговой модели...');

            const {
                points = [],
                edges = [],
                currentPhotoPoints = new Set(), // ID точек, совпавших с текущим фото
                width = 1200,
                height = 1000,
                padding = 50,
                outputPath = null
            } = options;

            // 🔥 ВАЖНО: проверяем, что точки есть
            if (!points || points.length === 0) {
                console.log('⚠️ Нет точек для визуализации');
                console.log('   📍 Передано currentPhotoPoints:', currentPhotoPoints.size);
                return null;
            }

            console.log(`   📊 Получено ${points.length} точек для визуализации`);
            console.log(`   📍 Совпало с текущим фото: ${currentPhotoPoints.size}`);

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
            const finalOutputPath = outputPath ||
                path.join(this.ensureOutputDir(), `model_${Date.now()}.png`);
           
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(finalOutputPath, buffer);

            console.log(`✅ Модель сохранена: ${finalOutputPath}`);
            return finalOutputPath;

        } catch (error) {
            console.log('❌ Ошибка создания визуализации модели:', error.message);
            console.log(error.stack);
            return null;
        }
    }

    /**
     * Рисует рёбра графа
     */
    drawEdges(ctx, edges, points, bounds, scale, width, height) {
        if (!edges || edges.length === 0) return;

        // Создаём карту точек для быстрого доступа
        const pointsMap = new Map();
        points.forEach(p => pointsMap.set(p.id, p));

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;

        let drawn = 0;
        for (const edge of edges) {
            const [id1, id2] = edge.split('--');
            const p1 = pointsMap.get(id1);
            const p2 = pointsMap.get(id2);

            if (!p1 || !p2) continue;

            const x1 = this.projectX(p1.x, bounds, scale, width);
            const y1 = this.projectY(p1.y, bounds, scale, height);
            const x2 = this.projectX(p2.x, bounds, scale, width);
            const y2 = this.projectY(p2.y, bounds, scale, height);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            drawn++;
        }
       
        if (drawn > 0) {
            console.log(`   🔗 Нарисовано рёбер: ${drawn}`);
        }
    }

    /**
     * Рисует точки с цветами по количеству подтверждений
     */
    drawPoints(ctx, points, currentPhotoPoints, bounds, scale, width, height) {
        console.log(`   🎨 Рисую ${points.length} точек...`);
       
        let stats = { red: 0, orange: 0, yellow: 0, blue: 0, gray: 0, purple: 0 };

        for (const point of points) {
            const x = this.projectX(point.x, bounds, scale, width);
            const y = this.projectY(point.y, bounds, scale, height);

            const confirmations = point.confirmationCount || 0;
           
            // Определяем цвет по количеству подтверждений
            let color;
            if (confirmations >= 11) {
                color = '#FF0000'; // Красный
                stats.red++;
            } else if (confirmations >= 5) {
                color = '#FFA500'; // Оранжевый
                stats.orange++;
            } else if (confirmations >= 2) {
                color = '#FFD700'; // Жёлтый
                stats.yellow++;
            } else if (confirmations >= 1) {
                color = '#4169E1'; // Синий
                stats.blue++;
            } else {
                color = '#808080'; // Серый
                stats.gray++;
            }

            // Размер точки зависит от подтверждений
            const size = 4 + Math.min(confirmations, 8);

            // Рисуем точку
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fill();

            // Если точка совпала с текущим фото - добавляем фиолетовый круг
            const isMatched = currentPhotoPoints.has(point.id);
            if (isMatched) {
                stats.purple++;
                ctx.strokeStyle = '#AA00FF'; // Фиолетовый
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(x, y, size + 3, 0, 2 * Math.PI);
                ctx.stroke();
            }

            // Для очень важных точек (11+ подтверждений) добавляем номер
            if (confirmations >= 11 && point.pairNumber) {
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(point.pairNumber.toString(), x, y);
            }
        }

        console.log(`   📊 Распределение:`);
        console.log(`      🔴 Красные (11+): ${stats.red}`);
        console.log(`      🟠 Оранжевые (5-10): ${stats.orange}`);
        console.log(`      🟡 Жёлтые (2-4): ${stats.yellow}`);
        console.log(`      🔵 Синие (1): ${stats.blue}`);
        console.log(`      ⚫ Серые (0): ${stats.gray}`);
        console.log(`      🟣 Фиолетовый круг: ${stats.purple}`);
    }

    /**
     * Рисует легенду
     */
    drawLegend(ctx, width, height) {
        const legendX = width - 250;
        const legendY = 30;
        const lineHeight = 25;

        // Полупрозрачный фон для легенды
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(legendX - 15, legendY - 15, 240, 180);

        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('📊 МОДЕЛЬ', legendX, legendY);

        // Цветные точки с описанием
        this.drawLegendItem(ctx, legendX, legendY + lineHeight, '#FF0000', '11+ подтверждений');
        this.drawLegendItem(ctx, legendX, legendY + lineHeight * 2, '#FFA500', '5-10 подтверждений');
        this.drawLegendItem(ctx, legendX, legendY + lineHeight * 3, '#FFD700', '2-4 подтверждения');
        this.drawLegendItem(ctx, legendX, legendY + lineHeight * 4, '#4169E1', '1 подтверждение');
        this.drawLegendItem(ctx, legendX, legendY + lineHeight * 5, '#808080', '0 подтверждений');

        // Фиолетовый круг
        ctx.strokeStyle = '#AA00FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(legendX + 7, legendY + lineHeight * 6 - 10, 6, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.fillText('совпало с текущим фото', legendX + 20, legendY + lineHeight * 6 - 5);
    }

    /**
     * Рисует элемент легенды
     */
    drawLegendItem(ctx, x, y, color, text) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + 7, y - 10, 6, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.fillText(text, x + 20, y - 7);
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
        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
       
        minX -= rangeX * 0.1;
        maxX += rangeX * 0.1;
        minY -= rangeY * 0.1;
        maxY += rangeY * 0.1;

        return { minX, maxX, minY, maxY };
    }

    /**
     * Вычисляет масштаб
     */
    calculateScale(bounds, width, height, padding) {
        const rangeX = bounds.maxX - bounds.minX;
        const rangeY = bounds.maxY - bounds.minY;
       
        if (rangeX === 0 || rangeY === 0) return 1;
       
        const scaleX = (width - padding * 2) / rangeX;
        const scaleY = (height - padding * 2) / rangeY;
        return Math.min(scaleX, scaleY, 10); // Ограничиваем максимальный масштаб
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
