// modules/footprint/merge-visualizer.js - ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const VectorGraph = require('./vector-graph');

class MergeVisualizer {
    constructor() {
        console.log('🎨 Создан ВЕКТОРНЫЙ визуализатор объединений');
    }

    // 1. СОВМЕСТИМЫЙ МЕТОД
    visualizeMerge(footprint1, footprint2, comparisonResult, outputPath = null) {
        return this.visualizeMergeEnhanced(
            footprint1,
            footprint2,
            comparisonResult,
            {
                outputPath: outputPath,
                showTransformation: true,
                showWeights: true,
                showConnections: true,
                showStats: true
            }
        );
    }

    // 2. УЛУЧШЕННАЯ ВЕКТОРНАЯ ВИЗУАЛИЗАЦИЯ
    async visualizeMergeEnhanced(footprint1, footprint2, comparisonResult = null, options = {}) {
        console.log('🎨 Создаю ВЕКТОРНУЮ визуализацию объединения...');
       
        try {
            const {
                showTransformation = true,
                showWeights = true,
                showConnections = true,
                showStats = true,
                outputPath = null,
                title = 'ВЕКТОРНАЯ ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ',
                transformation = null,
                vectorMatches = null
            } = options;

            // Извлечь точки
            const points1 = this.extractPoints(footprint1);
            const points2 = this.extractPoints(footprint2);

            console.log(`📊 Точки: ${points1.length} из ${footprint1.name}, ${points2.length} из ${footprint2.name}`);

            // 🔴 ШАГ 1: ВЕКТОРНОЕ СРАВНЕНИЕ
            let transformationResult = transformation;
            let matchesResult = vectorMatches;
           
            if (!transformationResult && points1.length > 3 && points2.length > 3) {
                console.log('🔍 Выполняю векторное сравнение для трансформации...');
                const vectorComparison = this.compareWithVectorGraphs(points1, points2);
                transformationResult = vectorComparison.transformation;
                matchesResult = vectorComparison.pointMatches;
                console.log(`🔗 Найдено ${matchesResult.length} векторных соответствий`);
            }

            // 🔴 ШАГ 2: ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ
            const transformedPoints2 = transformationResult
                ? this.applyTransformation(points2, transformationResult)
                : points2;

            // 🔴 ШАГ 3: НАЙТИ СОВПАДЕНИЯ
            const finalMatches = matchesResult || this.findPointMatches(points1, transformedPoints2, 10);

            console.log(`📈 Итоговые совпадения: ${finalMatches.length}`);
            if (finalMatches.length > 0) {
                console.log('🔍 Пример совпадения:', {
                    hasPoint1: !!finalMatches[0].point1,
                    hasPoint2: !!finalMatches[0].point2,
                    point1Type: finalMatches[0].point1 ? 'object' : 'undefined',
                    point2Type: finalMatches[0].point2 ? 'object' : 'undefined'
                });
            }

            // 🔴 ШАГ 4: СОЗДАТЬ ВИЗУАЛИЗАЦИЮ
            const canvas = createCanvas(1200, 800);
            const ctx = canvas.getContext('2d');

            // Фон
            this.drawBackground(ctx, canvas.width, canvas.height);

            // Заголовок
            this.drawTitle(ctx, title, footprint1.name, footprint2.name);

            // Область визуализации
            const vizArea = { x: 50, y: 180, width: 900, height: 500 };
            this.drawVisualizationArea(ctx, vizArea);

            // Нормализация
            const { scale, offsetX, offsetY } = this.normalizePoints([...points1, ...transformedPoints2], vizArea);

            // Связи
            if (showConnections && finalMatches.length > 0) {
                this.drawConnections(ctx, points1, transformedPoints2, finalMatches, scale, offsetX, offsetY);
            }

            // Точки первого следа
            points1.forEach((point, index) => {
                const x = offsetX + point.x * scale;
                const y = offsetY + point.y * scale;
                const weight = this.calculatePointWeight(point, finalMatches, index, 'first');
                const color = this.getPointColor(weight, false);
                const size = 4 + Math.min(weight, 6);
               
                this.drawPoint(ctx, x, y, color, size, showWeights && weight > 1 ? weight.toString() : '');
            });

            // Точки второго следа
            transformedPoints2.forEach((point, index) => {
                const x = offsetX + point.x * scale;
                const y = offsetY + point.y * scale;
                const weight = this.calculatePointWeight(point, finalMatches, index, 'second');
                const color = this.getPointColor(weight, true);
                const size = 4 + Math.min(weight, 6);
               
                this.drawPoint(ctx, x, y, color, size, showWeights && weight > 1 ? weight.toString() : '');
            });

            // Статистика
            if (showStats) {
                const stats = this.calculateStats(points1, points2, finalMatches, comparisonResult, transformationResult);
                this.drawStatistics(ctx, stats, vizArea.x + vizArea.width + 20, vizArea.y);
            }

            // Легенда
            this.drawLegend(ctx, points1.length, points2.length, finalMatches.length);

            // Трансформация
            if (showTransformation && transformationResult && transformationResult.confidence > 0.3) {
                this.drawTransformationInfo(ctx, transformationResult, 50, 720);
            }

            // Сохранение
            if (outputPath) {
                const dir = path.dirname(outputPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
               
                const buffer = canvas.toBuffer('image/png');
                fs.writeFileSync(outputPath, buffer);
                console.log(`✅ Векторная визуализация сохранена: ${outputPath}`);
            }

            return {
                canvas,
                buffer: canvas.toBuffer('image/png'),
                stats: {
                    points1: points1.length,
                    points2: points2.length,
                    matches: finalMatches.length,
                    matchRate: finalMatches.length / Math.min(points1.length, points2.length),
                    transformation: transformationResult,
                    similarity: comparisonResult?.similarity,
                    decision: comparisonResult?.decision
                },
                matches: finalMatches,
                transformation: transformationResult
            };

        } catch (error) {
            console.log(`❌ Ошибка векторной визуализации: ${error.message}`);
            console.error(error.stack);
            throw error;
        }
    }

    // 🔴 3. ВЕКТОРНОЕ СРАВНЕНИЕ С КОНВЕРТАЦИЕЙ ИНДЕКСОВ В ТОЧКИ
    compareWithVectorGraphs(points1, points2) {
        if (points1.length < 4 || points2.length < 4) {
            return { transformation: null, pointMatches: [], similarity: 0 };
        }

        try {
            const vectorGraph1 = new VectorGraph({ points: points1 });
            const vectorGraph2 = new VectorGraph({ points: points2 });
           
            vectorGraph1.createFromPoints(points1);
            vectorGraph2.createFromPoints(points2);

            const vectorComparison = vectorGraph1.compare(vectorGraph2);
            console.log(`📊 Векторное сравнение: схожесть=${vectorComparison.similarity?.toFixed(3)}, совпадений=${vectorComparison.pointMatches?.length || 0}`);

            // 🔴 КОНВЕРТАЦИЯ ИНДЕКСОВ В ТОЧКИ
            const pointMatches = (vectorComparison.pointMatches || []).map(match => {
                try {
                    const point1 = points1[match.pointA];
                    const point2 = points2[match.pointB];
                   
                    if (!point1 || !point2) {
                        console.log(`⚠️ Пропускаю совпадение: point1=${match.pointA}, point2=${match.pointB} - точки не найдены`);
                        return null;
                    }
                   
                    return {
                        point1: { x: point1.x, y: point1.y, ...point1 },
                        point2: { x: point2.x, y: point2.y, ...point2 },
                        distance: match.distance || 0,
                        score: match.score || 0,
                        originalIndexes: { pointA: match.pointA, pointB: match.pointB }
                    };
                } catch (error) {
                    console.log(`⚠️ Ошибка конвертации совпадения:`, error.message);
                    return null;
                }
            }).filter(match => match !== null);

            console.log(`🔗 Преобразовано ${pointMatches.length} векторных соответствий в точки`);

            return {
                transformation: vectorComparison.transformation,
                pointMatches: pointMatches, // 🔴 ТЕПЕРЬ ЭТО ТОЧКИ!
                similarity: vectorComparison.similarity,
                vectorComparison: vectorComparison
            };

        } catch (error) {
            console.log('⚠️ Ошибка векторного сравнения:', error.message);
            return { transformation: null, pointMatches: [], similarity: 0 };
        }
    }

    // 4. ВЕС ТОЧКИ
    calculatePointWeight(point, matches, pointIndex, footprintType) {
        let weight = 1;
       
        const match = matches.find(m => {
            if (footprintType === 'first') {
                return m.point1 && Math.abs(m.point1.x - point.x) < 0.001 && Math.abs(m.point1.y - point.y) < 0.001;
            } else {
                return m.point2 && Math.abs(m.point2.x - point.x) < 0.001 && Math.abs(m.point2.y - point.y) < 0.001;
            }
        });
       
        if (match) {
            weight = match.distance < 5 ? 3 : 2;
        }
       
        return weight;
    }

    // 5. ИЗВЛЕЧЬ ТОЧКИ
    extractPoints(footprint) {
        if (footprint.hybridFootprint?.pointTracker) {
            const trackerPoints = footprint.hybridFootprint.pointTracker.getAllPoints();
            if (trackerPoints.length > 0) {
                return trackerPoints.map(pt => ({
                    x: pt.x,
                    y: pt.y,
                    confidence: pt.rating || pt.confidence || 0.5,
                    confirmedCount: pt.confirmedCount || 0
                }));
            }
        }
       
        return footprint.originalPoints ||
               (footprint.graph ?
                Array.from(footprint.graph.nodes.values()).map(n => ({
                    x: n.x,
                    y: n.y,
                    confidence: n.confidence || 0.5
                })) : []);
    }

    // 6. ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ
    applyTransformation(points, transformation) {
        if (!transformation || transformation.type === 'insufficient_points') {
            return points;
        }
       
        return points.map(p => {
            let x = p.x;
            let y = p.y;
           
            if (transformation.translation) {
                x += transformation.translation.dx || 0;
                y += transformation.translation.dy || 0;
            }
           
            if (transformation.rotation && transformation.rotation !== 0) {
                const rad = transformation.rotation * Math.PI / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const newX = x * cos - y * sin;
                const newY = x * sin + y * cos;
                x = newX;
                y = newY;
            }
           
            if (transformation.scale && transformation.scale !== 1) {
                x *= transformation.scale;
                y *= transformation.scale;
            }
           
            return { ...p, x, y };
        });
    }

    // 7. ПОИСК СОВПАДЕНИЙ (геометрический)
    findPointMatches(points1, points2, maxDistance = 10) {
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
                    index2: bestIndex,
                    score: 1 - (bestDistance / maxDistance)
                });
                usedIndices.add(bestIndex);
            }
        }

        return matches;
    }

    // 🔴 8. DRAWCONNECTIONS С ЗАЩИТОЙ
    drawConnections(ctx, points1, points2, matches, scale, offsetX, offsetY) {
        if (!matches || matches.length === 0) {
            console.log('⚠️ Нет совпадений для рисования связей');
            return;
        }

        ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 3]);
       
        let validConnections = 0;
       
        matches.forEach((match, index) => {
            // 🔴 ПРОВЕРКА ФОРМАТА ДАННЫХ
            if (!match || (!match.point1 && !match.point2 && match.pointA === undefined)) {
                console.log(`⚠️ Совпадение ${index}: пустое`);
                return;
            }

            let p1, p2;
           
            if (match.point1 && match.point2) {
                // Формат с точками
                p1 = match.point1;
                p2 = match.point2;
            } else if (match.pointA !== undefined && match.pointB !== undefined) {
                // Формат с индексами
                p1 = points1[match.pointA];
                p2 = points2[match.pointB];
            } else {
                console.log(`⚠️ Совпадение ${index}: неизвестный формат`, match);
                return;
            }
           
            // Проверка существования точек
            if (!p1 || !p2) {
                console.log(`⚠️ Совпадение ${index}: точки не найдены`);
                return;
            }
           
            // Проверка координат
            if (typeof p1.x === 'undefined' || typeof p1.y === 'undefined' ||
                typeof p2.x === 'undefined' || typeof p2.y === 'undefined') {
                console.log(`⚠️ Совпадение ${index}: нет координат`, { p1, p2 });
                return;
            }
           
            const x1 = offsetX + p1.x * scale;
            const y1 = offsetY + p1.y * scale;
            const x2 = offsetX + p2.x * scale;
            const y2 = offsetY + p2.y * scale;
           
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
           
            validConnections++;
        });
       
        ctx.setLineDash([]);
       
        if (validConnections > 0) {
            console.log(`✅ Нарисовано ${validConnections}/${matches.length} связей`);
        }
    }

    // 9. ФОН
    drawBackground(ctx, width, height) {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    // 10. ЗАГОЛОВОК
    drawTitle(ctx, title, name1, name2) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.font = 'bold 32px Arial';
       
        ctx.strokeText(title, 50, 60);
        ctx.fillText(title, 50, 60);
       
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#4fc3f7';
        ctx.fillText(`📸 ${name1}`, 50, 100);
       
        ctx.fillStyle = '#ef5350';
        ctx.fillText(`📸 ${name2}`, 250, 100);
       
        ctx.fillStyle = '#ba68c8';
        ctx.fillText(`🔄 ВЕКТОРНОЕ ОБЪЕДИНЕНИЕ`, 450, 100);
    }

    // 11. ОБЛАСТЬ ВИЗУАЛИЗАЦИИ
    drawVisualizationArea(ctx, area) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 3;
        ctx.strokeRect(area.x, area.y, area.width, area.height);
       
        ctx.fillStyle = 'rgba(30, 30, 46, 0.8)';
        ctx.fillRect(area.x + 1, area.y + 1, area.width - 2, area.height - 2);
    }

    // 12. ТОЧКА
    drawPoint(ctx, x, y, color, size, label = '') {
        ctx.beginPath();
        ctx.arc(x, y, size + 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
       
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
       
        if (label) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, x, y);
        }
    }

    // 13. НОРМАЛИЗАЦИЯ
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

    // 14. СТАТИСТИКА
    calculateStats(points1, points2, matches, comparisonResult, transformation) {
        const matchRate = Math.min(points1.length, points2.length) > 0
            ? (matches.length / Math.min(points1.length, points2.length)) * 100
            : 0;

        let avgDistance = 0;
        if (matches.length > 0) {
            const totalDistance = matches.reduce((sum, m) => sum + (m.distance || 0), 0);
            avgDistance = totalDistance / matches.length;
        }

        return {
            totalPoints: points1.length + points2.length,
            uniquePoints1: points1.length,
            uniquePoints2: points2.length,
            matchedPoints: matches.length,
            matchRate: Math.round(matchRate),
            avgDistance: avgDistance.toFixed(1),
            transformationConfidence: transformation?.confidence ? Math.round(transformation.confidence * 100) : 0,
            similarity: comparisonResult?.similarity,
            decision: comparisonResult?.decision
        };
    }

    // 15. ОТРИСОВКА СТАТИСТИКИ
    drawStatistics(ctx, stats, x, y) {
        const boxWidth = 200;
        const boxHeight = 460;
       
        ctx.fillStyle = 'rgba(25, 25, 35, 0.9)';
        ctx.strokeStyle = 'rgba(100, 100, 200, 0.5)';
        ctx.lineWidth = 2;
       
        this.drawRoundedRect(ctx, x, y, boxWidth, boxHeight, 10);
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
       
        if (stats.decision) {
            lineY += 10;
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

    // 16. ЗАКРУГЛЕННЫЙ ПРЯМОУГОЛЬНИК
    drawRoundedRect(ctx, x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
       
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    // 🔴 17. ЛЕГЕНДА (ИСПРАВЛЕННАЯ)
    drawLegend(ctx, count1, count2, matchesCount) {
        let startY = 700; // let вместо const!
       
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
            ctx.fillStyle = item.color;
            ctx.fillRect(x, startY - 15, 20, 20);
           
            ctx.fillStyle = '#cccccc';
            ctx.font = '14px Arial';
            ctx.fillText(item.text, x + 25, startY);
           
            x += 180;
            if (index === 2) {
                x = 200;
                startY += 25; // 🔴 ТЕПЕРЬ МОЖНО ИЗМЕНЯТЬ
            }
        });
    }

    // 18. ИНФО О ТРАНСФОРМАЦИИ
    drawTransformationInfo(ctx, transformation, x, y) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '14px Arial';
       
        ctx.fillText(`🔄 ТРАНСФОРМАЦИЯ:`, x, y);
        if (transformation.translation) {
            ctx.fillText(`├─ Смещение: (${transformation.translation.dx?.toFixed(1) || 0}, ${transformation.translation.dy?.toFixed(1) || 0})`, x + 10, y + 20);
        }
        ctx.fillText(`├─ Поворот: ${transformation.rotation?.toFixed(1) || 0}°`, x + 10, y + 40);
        ctx.fillText(`├─ Масштаб: ${transformation.scale?.toFixed(3) || 1}`, x + 10, y + 60);
        ctx.fillText(`└─ Уверенность: ${Math.round((transformation.confidence || 0) * 100)}%`, x + 10, y + 80);
    }

    // 19. ЦВЕТ ТОЧКИ
    getPointColor(weight, isSecondFootprint = false) {
        if (weight >= 3) return 'rgba(0, 200, 83, 0.9)';
        if (weight == 2) return 'rgba(156, 39, 176, 0.8)';
       
        return isSecondFootprint
            ? 'rgba(255, 50, 50, 0.7)'
            : 'rgba(50, 100, 255, 0.7)';
    }

    // 20. ПОДПИСЬ ДЛЯ TELEGRAM
    createMergeCaption(footprint1, footprint2, stats) {
        return `<b>🎭 ВЕКТОРНАЯ ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ</b>\n\n` +
               `<b>📸 ${footprint1.name}:</b> ${stats.points1} точек\n` +
               `<b>📸 ${footprint2.name}:</b> ${stats.points2} точек\n` +
               `<b>🔗 Топологических соответствий:</b> ${stats.matches} (${stats.matchRate}%)\n` +
               `<b>💎 Схожесть:</b> ${stats.similarity?.toFixed(3) || 'N/A'}\n` +
               `<b>🤔 Решение:</b> ${stats.decision || 'N/A'}\n\n` +
               `<i>🔵 ${footprint1.name} | 🔴 ${footprint2.name} | 🟣 Совпадения</i>`;
    }
}

module.exports = MergeVisualizer;
