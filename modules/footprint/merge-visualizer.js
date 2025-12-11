// modules/footprint/merge-visualizer.js - УЛУЧШЕННАЯ ВЕРСИЯ
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

class MergeVisualizer {
    constructor() {
        console.log('🎨 Создан УЛУЧШЕННЫЙ визуализатор объединений');
    }

    // 1. ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ С ТРАНСФОРМАЦИЕЙ И СТАТИСТИКОЙ
    async visualizeMerge(footprint1, footprint2, comparisonResult = null, options = {}) {
        console.log(`🎨 Создаю УЛУЧШЕННУЮ визуализацию объединения...`);
        
        try {
            // Настройки
            const {
                showTransformation = true,
                showWeights = true,
                showConnections = true,
                showStats = true,
                outputPath = null,
                title = 'ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ СЛЕДОВ'
            } = options;

            // Получить точки из обоих отпечатков
            let points1 = footprint1.originalPoints || 
                         (footprint1.graph ? 
                          Array.from(footprint1.graph.nodes.values()).map(n => ({x: n.x, y: n.y, confidence: n.confidence || 0.5})) : 
                          []);
            
            let points2 = footprint2.originalPoints || 
                         (footprint2.graph ? 
                          Array.from(footprint2.graph.nodes.values()).map(n => ({x: n.x, y: n.y, confidence: n.confidence || 0.5})) : 
                          []);

            // Если есть гибридные отпечатки, получить точки из трекера
            if (footprint1.hybridFootprint?.pointTracker) {
                const trackerPoints = footprint1.hybridFootprint.pointTracker.getAllPoints();
                if (trackerPoints.length > 0) {
                    points1 = trackerPoints.map(pt => ({
                        x: pt.x,
                        y: pt.y,
                        confidence: pt.rating || pt.confidence || 0.5,
                        weight: pt.rating || 1,
                        confirmedCount: pt.confirmedCount || 0
                    }));
                }
            }

            if (footprint2.hybridFootprint?.pointTracker) {
                const trackerPoints = footprint2.hybridFootprint.pointTracker.getAllPoints();
                if (trackerPoints.length > 0) {
                    points2 = trackerPoints.map(pt => ({
                        x: pt.x,
                        y: pt.y,
                        confidence: pt.rating || pt.confidence || 0.5,
                        weight: pt.rating || 1,
                        confirmedCount: pt.confirmedCount || 0
                    }));
                }
            }

            console.log(`📊 Точки: ${points1.length} из ${footprint1.name}, ${points2.length} из ${footprint2.name}`);

            // Найти совпадения точек (используем трекер или простой поиск)
            const matches = this.findPointMatches(points1, points2);
            const transformation = this.calculateTransformation(matches);

            // Применить трансформацию к точкам второго отпечатка
            const transformedPoints2 = this.applyTransformation(points2, transformation);

            // Создать канвас
            const canvas = createCanvas(1200, 800);
            const ctx = canvas.getContext('2d');

            // Очистка фона (градиент как в топологии)
            this.drawBackground(ctx, canvas.width, canvas.height);

            // ========== ЗАГОЛОВОК ==========
            this.drawTitle(ctx, title, footprint1.name, footprint2.name);

            // ========== ОБЛАСТЬ ВИЗУАЛИЗАЦИИ ==========
            const vizArea = {
                x: 50,
                y: 180,
                width: 900,
                height: 500
            };

            this.drawVisualizationArea(ctx, vizArea);

            // ========== ВИЗУАЛИЗАЦИЯ ТОЧЕК ==========
            const { scale, offsetX, offsetY } = this.normalizePoints(
                [...points1, ...transformedPoints2], 
                vizArea
            );

            // Рисуем связи между совпавшими точками
            if (showConnections && matches.length > 0) {
                this.drawConnections(ctx, points1, transformedPoints2, matches, scale, offsetX, offsetY);
            }

            // Рисуем точки первого отпечатка (с весами)
            points1.forEach((point, index) => {
                const x = offsetX + point.x * scale;
                const y = offsetY + point.y * scale;
                const weight = point.confirmedCount || point.weight || 1;
                
                // Цвет по весу/рейтингу
                const color = this.getPointColor(weight, point.confidence || 0.5);
                const size = 3 + Math.min(weight, 5);
                
                this.drawPoint(ctx, x, y, color, size, 
                              showWeights && weight > 1 ? weight.toString() : '');
            });

            // Рисуем точки второго отпечатка (трансформированные)
            transformedPoints2.forEach((point, index) => {
                const x = offsetX + point.x * scale;
                const y = offsetY + point.y * scale;
                const weight = point.confirmedCount || point.weight || 1;
                
                // Для точек второго отпечатка используем другой стиль
                const color = this.getPointColor(weight, point.confidence || 0.5, true);
                const size = 3 + Math.min(weight, 5);
                
                this.drawPoint(ctx, x, y, color, size, 
                              showWeights && weight > 1 ? weight.toString() : '');
            });

            // ========== СТАТИСТИКА ==========
            if (showStats) {
                const stats = this.calculateStats(points1, points2, matches, comparisonResult, transformation);
                this.drawStatistics(ctx, stats, vizArea.x + vizArea.width + 20, vizArea.y);
            }

            // ========== ЛЕГЕНДА ==========
            this.drawLegend(ctx, points1.length, points2.length, matches.length);

            // ========== ТРАНСФОРМАЦИЯ ==========
            if (showTransformation && transformation.confidence > 0.5) {
                this.drawTransformationInfo(ctx, transformation, 50, 720);
            }

            // ========== СОХРАНЕНИЕ ==========
            if (outputPath) {
                const dir = path.dirname(outputPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                const buffer = canvas.toBuffer('image/png');
                fs.writeFileSync(outputPath, buffer);
                console.log(`✅ Улучшенная визуализация сохранена: ${outputPath}`);
            }

            return {
                canvas,
                buffer: canvas.toBuffer('image/png'),
                stats: {
                    points1: points1.length,
                    points2: points2.length,
                    matches: matches.length,
                    matchRate: matches.length / Math.min(points1.length, points2.length),
                    transformation,
                    similarity: comparisonResult?.similarity,
                    decision: comparisonResult?.decision
                },
                matches,
                transformation
            };

        } catch (error) {
            console.log(`❌ Ошибка создания улучшенной визуализации: ${error.message}`);
            console.error(error.stack);
            throw error;
        }
    }

    // 2. НАЙТИ СОВПАДЕНИЯ ТОЧЕК
    findPointMatches(points1, points2, maxDistance = 15) {
        const matches = [];
        const usedIndices = new Set();

        for (let i = 0; i < points1.length; i++) {
            const p1 = points1[i];
            let bestMatch = null;
            let bestDistance = Infinity;
            let bestIndex = -1;

            for (let j = 0; j < points2.length; j++) {
                if (usedIndices.has(j)) continue;

                const p2 = points2[j];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < maxDistance && distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = p2;
                    bestIndex = j;
                }
            }

            if (bestMatch && bestDistance < maxDistance) {
                matches.push({
                    point1: p1,
                    point2: bestMatch,
                    distance: bestDistance,
                    index1: i,
                    index2: bestIndex
                });
                usedIndices.add(bestIndex);
            }
        }

        return matches;
    }

    // 3. РАССЧИТАТЬ ТРАНСФОРМАЦИЮ
    calculateTransformation(matches) {
        if (matches.length < 3) {
            return {
                dx: 0,
                dy: 0,
                rotation: 0,
                scale: 1,
                confidence: 0
            };
        }

        let sumDx = 0, sumDy = 0;
        matches.forEach(match => {
            sumDx += match.point2.x - match.point1.x;
            sumDy += match.point2.y - match.point1.y;
        });

        return {
            dx: sumDx / matches.length,
            dy: sumDy / matches.length,
            rotation: 0, // В будущем можно добавить расчет поворота
            scale: 1,    // В будущем можно добавить расчет масштаба
            confidence: Math.min(1, matches.length / 5),
            matchesUsed: matches.length
        };
    }

    // 4. ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ
    applyTransformation(points, transformation) {
        return points.map(p => ({
            ...p,
            x: p.x + transformation.dx,
            y: p.y + transformation.dy
        }));
    }

    // 5. НОРМАЛИЗАЦИЯ ТОЧЕК ДЛЯ ОТОБРАЖЕНИЯ
    normalizePoints(points, vizArea) {
        if (points.length === 0) {
            return { scale: 1, offsetX: vizArea.x + vizArea.width / 2, offsetY: vizArea.y + vizArea.height / 2 };
        }

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const width = maxX - minX || 1;
        const height = maxY - minY || 1;

        const scaleX = (vizArea.width * 0.8) / width;
        const scaleY = (vizArea.height * 0.8) / height;
        const scale = Math.min(scaleX, scaleY);

        const offsetX = vizArea.x + (vizArea.width - width * scale) / 2;
        const offsetY = vizArea.y + (vizArea.height - height * scale) / 2;

        return { scale, offsetX, offsetY, minX, minY };
    }

    // 6. ПОЛУЧИТЬ ЦВЕТ ТОЧКИ ПО ВЕСУ
    getPointColor(weight, confidence, isSecondFootprint = false) {
        if (weight >= 3) return 'rgba(0, 200, 83, 0.9)';      // Зеленый - ядро (вес 3+)
        if (weight == 2) return 'rgba(156, 39, 176, 0.8)';   // Фиолетовый - совпадение (вес 2)
        
        if (isSecondFootprint) {
            return 'rgba(255, 50, 50, 0.7)';  // Красный - только во втором отпечатке
        } else {
            return 'rgba(50, 100, 255, 0.7)'; // Синий - только в первом отпечатке
        }
    }

    // 7. РАССЧИТАТЬ СТАТИСТИКУ
    calculateStats(points1, points2, matches, comparisonResult, transformation) {
        const matchRate = Math.min(points1.length, points2.length) > 0 
            ? (matches.length / Math.min(points1.length, points2.length)) * 100 
            : 0;

        // Среднее расстояние между совпавшими точками
        let avgDistance = 0;
        if (matches.length > 0) {
            const totalDistance = matches.reduce((sum, m) => sum + m.distance, 0);
            avgDistance = totalDistance / matches.length;
        }

        // Распределение весов
        const weightDistribution = { weight1: 0, weight2: 0, weight3plus: 0 };
        const allPoints = [...points1, ...points2];
        allPoints.forEach(p => {
            const weight = p.confirmedCount || p.weight || 1;
            if (weight === 1) weightDistribution.weight1++;
            else if (weight === 2) weightDistribution.weight2++;
            else if (weight >= 3) weightDistribution.weight3plus++;
        });

        return {
            totalPoints: points1.length + points2.length,
            uniquePoints1: points1.length,
            uniquePoints2: points2.length,
            matchedPoints: matches.length,
            matchRate: Math.round(matchRate),
            avgDistance: avgDistance.toFixed(1),
            transformationConfidence: Math.round(transformation.confidence * 100),
            weightDistribution,
            similarity: comparisonResult?.similarity,
            decision: comparisonResult?.decision
        };
    }

    // 8. МЕТОДЫ ОТРИСОВКИ (стиль как в топологии)

    drawBackground(ctx, width, height) {
        // Градиентный фон
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Сетка
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        const gridSize = 50;
        
        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    drawTitle(ctx, title, name1, name2) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.font = 'bold 32px Arial';
        
        // Заголовок с обводкой
        ctx.strokeText(title, 50, 60);
        ctx.fillText(title, 50, 60);
        
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#4fc3f7';
        ctx.fillText(`📸 ${name1}`, 50, 100);
        
        ctx.fillStyle = '#ef5350';
        ctx.fillText(`📸 ${name2}`, 250, 100);
        
        ctx.fillStyle = '#ba68c8';
        ctx.fillText(`🔄 АВТООБЪЕДИНЕНИЕ`, 450, 100);
    }

    drawVisualizationArea(ctx, area) {
        // Прямоугольник области визуализации
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 3;
        ctx.strokeRect(area.x, area.y, area.width, area.height);
        
        // Внутренняя заливка
        ctx.fillStyle = 'rgba(30, 30, 46, 0.8)';
        ctx.fillRect(area.x + 1, area.y + 1, area.width - 2, area.height - 2);
    }

    drawPoint(ctx, x, y, color, size, label = '') {
        // Внешний контур
        ctx.beginPath();
        ctx.arc(x, y, size + 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
        
        // Основной круг
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Внутренний круг для объема
        ctx.beginPath();
        ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();
        
        // Текст веса
        if (label) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x, y);
        }
    }

    drawConnections(ctx, points1, points2, matches, scale, offsetX, offsetY) {
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 3]);
        
        matches.forEach(match => {
            const x1 = offsetX + match.point1.x * scale;
            const y1 = offsetY + match.point1.y * scale;
            const x2 = offsetX + match.point2.x * scale;
            const y2 = offsetY + match.point2.y * scale;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        });
        
        ctx.setLineDash([]);
    }

    drawStatistics(ctx, stats, x, y) {
        const boxWidth = 200;
        const boxHeight = 460;
        
        // Фон статистики
        ctx.fillStyle = 'rgba(25, 25, 35, 0.9)';
        ctx.strokeStyle = 'rgba(100, 100, 200, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, boxWidth, boxHeight, 10);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('📊 СТАТИСТИКА', x + 10, y + 30);
        
        ctx.font = '14px Arial';
        let lineY = y + 60;
        
        const statItems = [
            `📸 Всего точек: ${stats.totalPoints}`,
            `🔵 ${stats.uniquePoints1} точек`,
            `🔴 ${stats.uniquePoints2} точек`,
            `🔗 Совпадений: ${stats.matchedPoints}`,
            `📈 % совпадения: ${stats.matchRate}%`,
            `📏 Ср. расстояние: ${stats.avgDistance}px`,
            `🎯 Уверенность: ${stats.transformationConfidence}%`
        ];
        
        statItems.forEach(item => {
            ctx.fillStyle = '#cccccc';
            ctx.fillText(item, x + 15, lineY);
            lineY += 25;
        });
        
        // Веса точек
        lineY += 15;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('⚖️ ВЕСА ТОЧЕК:', x + 15, lineY);
        lineY += 25;
        
        ctx.fillStyle = '#4fc3f7';
        ctx.fillText(`🔵 Вес 1: ${stats.weightDistribution.weight1}`, x + 15, lineY);
        lineY += 20;
        
        ctx.fillStyle = '#ba68c8';
        ctx.fillText(`🟣 Вес 2: ${stats.weightDistribution.weight2}`, x + 15, lineY);
        lineY += 20;
        
        ctx.fillStyle = '#66bb6a';
        ctx.fillText(`🟢 Вес 3+: ${stats.weightDistribution.weight3plus}`, x + 15, lineY);
        
        // Решение
        if (stats.decision) {
            lineY += 30;
            ctx.font = 'bold 16px Arial';
            if (stats.decision === 'same') {
                ctx.fillStyle = '#4caf50';
                ctx.fillText('✅ ОДИН СЛЕД', x + 15, lineY);
            } else if (stats.decision === 'similar') {
                ctx.fillStyle = '#ff9800';
                ctx.fillText('⚠️ ПОХОЖИЕ', x + 15, lineY);
            } else {
                ctx.fillStyle = '#f44336';
                ctx.fillText('❌ РАЗНЫЕ', x + 15, lineY);
            }
        }
    }

    drawLegend(ctx, count1, count2, matchesCount) {
        const startY = 700;
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('📋 ЛЕГЕНДА:', 50, startY);
        
        const legendItems = [
            { color: 'rgba(50, 100, 255, 0.7)', text: `🔵 ${count1} точек` },
            { color: 'rgba(255, 50, 50, 0.7)', text: `🔴 ${count2} точек` },
            { color: 'rgba(156, 39, 176, 0.8)', text: `🟣 Совпадения (${matchesCount})` },
            { color: 'rgba(0, 200, 83, 0.9)', text: '🟢 Ядро (вес 3+)' },
            { color: 'rgba(255, 215, 0, 0.6)', text: '🟡 Связи совпадений' }
        ];
        
        let x = 200;
        legendItems.forEach((item, index) => {
            // Цветной квадрат
            ctx.fillStyle = item.color;
            ctx.fillRect(x, startY - 15, 20, 20);
            
            // Текст
            ctx.fillStyle = '#cccccc';
            ctx.font = '14px Arial';
            ctx.fillText(item.text, x + 25, startY);
            
            x += 180;
            if (index === 2) {
                x = 200;
                startY += 25;
            }
        });
    }

    drawTransformationInfo(ctx, transformation, x, y) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '14px Arial';
        
        ctx.fillText(`🔄 ТРАНСФОРМАЦИЯ:`, x, y);
        ctx.fillText(`├─ Смещение: (${transformation.dx.toFixed(1)}, ${transformation.dy.toFixed(1)})`, x + 10, y + 20);
        ctx.fillText(`├─ Поворот: ${transformation.rotation.toFixed(1)}°`, x + 10, y + 40);
        ctx.fillText(`├─ Масштаб: ${transformation.scale.toFixed(3)}`, x + 10, y + 60);
        ctx.fillText(`└─ Уверенность: ${Math.round(transformation.confidence * 100)}%`, x + 10, y + 80);
    }

    // 9. СОЗДАТЬ ОПИСАНИЕ ДЛЯ TELEGRAM
    createMergeCaption(footprint1, footprint2, stats) {
        return `<b>🎭 УЛУЧШЕННАЯ ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ</b>\n\n` +
               `<b>📸 ${footprint1.name}:</b> ${stats.points1} точек\n` +
               `<b>📸 ${footprint2.name}:</b> ${stats.points2} точек\n` +
               `<b>🔗 Совпадений:</b> ${stats.matches} (${stats.matchRate}%)\n` +
               `<b>📏 Среднее расстояние:</b> ${stats.avgDistance}px\n` +
               `<b>💎 Схожесть:</b> ${stats.similarity?.toFixed(3) || 'N/A'}\n` +
               `<b>🤔 Решение:</b> ${stats.decision || 'N/A'}\n\n` +
               `<b>⚖️ ВЕСА ТОЧЕК:</b>\n` +
               `🔵 Вес 1: ${stats.weightDistribution.weight1}\n` +
               `🟣 Вес 2: ${stats.weightDistribution.weight2}\n` +
               `🟢 Вес 3+: ${stats.weightDistribution.weight3plus}\n\n` +
               `<i>🔵 ${footprint1.name} | 🔴 ${footprint2.name} | 🟣 Совпадения</i>`;
    }

    // 10. ТЕСТИРОВАНИЕ НА ДВУХ ТЕСТОВЫХ НАБОРАХ ТОЧЕК
    static testVisualization() {
        console.log('\n🧪 ТЕСТИРУЮ УЛУЧШЕННУЮ ВИЗУАЛИЗАЦИЮ...');
        
        // Создаем тестовые отпечатки
        const testFootprint1 = {
            name: 'Тестовый след 1',
            originalPoints: []
        };
        
        const testFootprint2 = {
            name: 'Тестовый след 2',
            originalPoints: []
        };
        
        // Генерируем похожие точки
        for (let i = 0; i < 25; i++) {
            const x1 = 100 + Math.random() * 300;
            const y1 = 100 + Math.random() * 200;
            
            // Второй набор - немного смещенный
            const x2 = x1 + Math.random() * 40 - 20;
            const y2 = y1 + Math.random() * 40 - 20;
            
            testFootprint1.originalPoints.push({
                x: x1,
                y: y1,
                confidence: 0.7 + Math.random() * 0.3,
                weight: Math.random() > 0.7 ? 2 : 1
            });
            
            testFootprint2.originalPoints.push({
                x: x2,
                y: y2,
                confidence: 0.7 + Math.random() * 0.3,
                weight: Math.random() > 0.6 ? 2 : 1
            });
        }
        
        const visualizer = new MergeVisualizer();
        const testResult = {
            similarity: 0.85,
            decision: 'same',
            reason: 'Тестовое сравнение'
        };
        
        const outputPath = `test_merge_visualization_${Date.now()}.png`;
        
        const result = visualizer.visualizeMerge(
            testFootprint1,
            testFootprint2,
            testResult,
            {
                outputPath: outputPath,
                showTransformation: true,
                showWeights: true,
                showConnections: true,
                showStats: true,
                title: 'ТЕСТ УЛУЧШЕННОЙ ВИЗУАЛИЗАЦИИ'
            }
        );
        
        console.log(`✅ Тестовая визуализация сохранена: ${outputPath}`);
        console.log(`📊 Статистика: ${result.stats.matches} совпадений из ${result.stats.points1 + result.stats.points2} точек`);
        
        return result;
    }
}

// Добавляем поддержку roundRect для старых версий canvas
if (typeof CanvasRenderingContext2D.prototype.roundRect === 'undefined') {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        
        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + width, y, radius);
        this.closePath();
        return this;
    };
}

module.exports = MergeVisualizer;
