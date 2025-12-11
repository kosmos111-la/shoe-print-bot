// modules/footprint/merge-visualizer.js - ИСПРАВЛЕННЫЙ ДЛЯ СУПЕР-МОДЕЛИ
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const VectorGraph = require('./vector-graph');

class MergeVisualizer {
    constructor() {
        console.log('🎨 Создан визуализатор супер-моделей');
    }

    // 1. ГЛАВНЫЙ МЕТОД - СОХРАНЯЕМ ИНТЕРФЕЙС
    visualizeMerge(footprint1, footprint2, mergedFootprint, outputPath = null) {
        console.log('🎨 Визуализирую СУПЕР-МОДЕЛЬ...');
       
        // ВАЖНО: третий аргумент mergedFootprint - это уже готовая супер-модель
        // Игнорируем footprint1 и footprint2, работаем только с mergedFootprint
       
        if (!mergedFootprint || !mergedFootprint.originalPoints) {
            console.log('⚠️ Нет супер-модели для визуализации');
            return this.createFallbackImage(outputPath);
        }

        // Используем супер-модель
        return this.visualizeSuperModel(mergedFootprint, outputPath);
    }

    // 2. НОВЫЙ МЕТОД ДЛЯ СУПЕР-МОДЕЛИ
    visualizeSuperModel(superModel, outputPath = null) {
        console.log(`🎨 Визуализирую супер-модель "${superModel.name}"...`);
       
        const points = superModel.originalPoints || [];
        if (points.length === 0) {
            console.log('⚠️ Нет точек в супер-модели');
            return this.createFallbackImage(outputPath);
        }

        // Создаем изображение
        const canvas = createCanvas(800, 600);
        const ctx = canvas.getContext('2d');

        // Фон
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, 800, 600);

        // Находим границы и масштаб
        const bounds = this.calculateBounds(points);
        const scale = this.calculateScale(bounds, 700, 500);
        const offsetX = 50;
        const offsetY = 50;

        // Сетка
        this.drawGrid(ctx, bounds, scale, offsetX, offsetY);

        // ТОЛЬКО ТОЧКИ СУПЕР-МОДЕЛИ
        this.drawSuperModelPoints(ctx, points, bounds, scale, offsetX, offsetY);

        // Статистика
        this.drawSuperModelStats(ctx, superModel, points);

        // Легенда
        this.drawLegend(ctx);

        // Сохраняем
        const finalPath = outputPath || `super-model-${Date.now()}.png`;
        this.saveImage(canvas, finalPath);

        console.log(`✅ Супер-модель визуализирована: ${points.length} точек`);
        return finalPath;
    }

    // 3. РИСУЕМ ТОЧКИ СУПЕР-МОДЕЛИ
    drawSuperModelPoints(ctx, points, bounds, scale, offsetX, offsetY) {
        points.forEach((point, index) => {
            const confidence = point.confidence || point.rating || 0.5;
           
            // Координаты
            const x = offsetX + (point.x - bounds.minX) * scale;
            const y = offsetY + (bounds.maxY - point.y) * scale; // Инвертируем Y
           
            // Цвет по confidence
            let color;
            if (confidence > 0.8) color = '#00ff88';      // Высокий
            else if (confidence > 0.5) color = '#ffaa00'; // Средний
            else color = '#ff4444';                      // Низкий
           
            // Размер по confidence
            const radius = 3 + confidence * 7;
           
            // Рисуем точку
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = color + 'cc'; // с прозрачностью
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
           
            // Номер для точек с высокой confidence
            if (confidence > 0.7 && index < 15) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${index + 1}`, x, y - radius - 6);
            }
        });
    }

    // 4. СТАТИСТИКА СУПЕР-МОДЕЛИ
    drawSuperModelStats(ctx, superModel, points) {
        const avgConfidence = points.reduce((sum, p) =>
            sum + (p.confidence || p.rating || 0.5), 0) / points.length;
       
        const highConf = points.filter(p => (p.confidence || p.rating || 0.5) > 0.8).length;
        const mediumConf = points.filter(p => {
            const conf = p.confidence || p.rating || 0.5;
            return conf >= 0.5 && conf <= 0.8;
        }).length;
        const lowConf = points.filter(p => (p.confidence || p.rating || 0.5) < 0.5).length;
       
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(20, 20, 250, 130);
       
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('🎯 СУПЕР-МОДЕЛЬ', 30, 40);
       
        ctx.font = '12px Arial';
        ctx.fillText(`📍 Точек: ${points.length}`, 30, 65);
        ctx.fillText(`💎 Средняя уверенность: ${(avgConfidence * 100).toFixed(1)}%`, 30, 85);
        ctx.fillText(`🟢 Высокая: ${highConf}`, 30, 105);
        ctx.fillText(`🟡 Средняя: ${mediumConf}`, 30, 125);
        ctx.fillText(`🔴 Низкая: ${lowConf}`, 30, 145);
    }

    // 5. ЛЕГЕНДА
    drawLegend(ctx) {
        const legendX = 600;
        const legendY = 30;
       
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(legendX - 10, legendY - 10, 180, 90);
       
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('🌈 Легенда', legendX, legendY);
       
        ctx.font = '11px Arial';
       
        // Высокая
        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.arc(legendX + 10, legendY + 25, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Высокая уверенность', legendX + 25, legendY + 28);
       
        // Средняя
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(legendX + 10, legendY + 45, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Средняя уверенность', legendX + 25, legendY + 48);
       
        // Низкая
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(legendX + 10, legendY + 65, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Низкая уверенность', legendX + 25, legendY + 68);
    }

    // 6. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    calculateBounds(points) {
        const bounds = {
            minX: Math.min(...points.map(p => p.x)),
            maxX: Math.max(...points.map(p => p.x)),
            minY: Math.min(...points.map(p => p.y)),
            maxY: Math.max(...points.map(p => p.y))
        };
       
        // Добавляем отступы
        const padding = Math.max(20, (bounds.maxX - bounds.minX) * 0.1);
        bounds.minX -= padding;
        bounds.maxX += padding;
        bounds.minY -= padding;
        bounds.maxY += padding;
       
        return bounds;
    }

    calculateScale(bounds, width, height) {
        const dataWidth = bounds.maxX - bounds.minX;
        const dataHeight = bounds.maxY - bounds.minY;
       
        if (dataWidth === 0 || dataHeight === 0) return 1;
       
        const scaleX = width / dataWidth;
        const scaleY = height / dataHeight;
       
        return Math.min(scaleX, scaleY);
    }

    drawGrid(ctx, bounds, scale, offsetX, offsetY) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;
       
        // Вертикальные линии
        const stepX = Math.max(50, Math.round((bounds.maxX - bounds.minX) / 10 / 50) * 50);
        for (let x = Math.ceil(bounds.minX / stepX) * stepX; x <= bounds.maxX; x += stepX) {
            const canvasX = offsetX + (x - bounds.minX) * scale;
            ctx.beginPath();
            ctx.moveTo(canvasX, offsetY);
            ctx.lineTo(canvasX, offsetY + (bounds.maxY - bounds.minY) * scale);
            ctx.stroke();
        }
       
        // Горизонтальные линии
        const stepY = Math.max(50, Math.round((bounds.maxY - bounds.minY) / 10 / 50) * 50);
        for (let y = Math.ceil(bounds.minY / stepY) * stepY; y <= bounds.maxY; y += stepY) {
            const canvasY = offsetY + (bounds.maxY - y) * scale;
            ctx.beginPath();
            ctx.moveTo(offsetX, canvasY);
            ctx.lineTo(offsetX + (bounds.maxX - bounds.minX) * scale, canvasY);
            ctx.stroke();
        }
    }

    saveImage(canvas, filePath) {
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(filePath, buffer);
    }

    createFallbackImage(outputPath) {
        const canvas = createCanvas(400, 300);
        const ctx = canvas.getContext('2d');
       
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, 400, 300);
       
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Нет данных для визуализации', 200, 150);
       
        const path = outputPath || `fallback-${Date.now()}.png`;
        this.saveImage(canvas, path);
       
        return path;
    }

    // СТАРЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ (можно удалить позже)
    visualizeMergeEnhanced() {
        console.log('⚠️ Используется устаревший метод, используйте visualizeMerge');
        return this.createFallbackImage();
    }
   
    extractPoints() { return []; }
    compareWithVectorGraphs() { return { transformation: null, pointMatches: [] }; }
    applyTransformation() { return []; }
    findPointMatches() { return []; }
}

module.exports = MergeVisualizer;
