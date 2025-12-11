// modules/footprint/merge-visualizer.js - ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕННОГО РЕЗУЛЬТАТА
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const VectorGraph = require('./vector-graph');

class MergeVisualizer {
    constructor() {
        console.log('🎨 Создан визуализатор объединенных следов');
    }

    // 1. ОСНОВНОЙ МЕТОД ДЛЯ СОВМЕСТИМОСТИ
    visualizeMerge(footprint1, footprint2, comparisonResult, outputPath = null) {
        return this.visualizeMergedResult(
            footprint1,
            footprint2,
            comparisonResult,
            {
                outputPath: outputPath,
                showStats: true,
                showLegend: true,
                showConfidence: true
            }
        );
    }

    // 🔴 ДОБАВЛЕНО: МЕТОД ДЛЯ СОВМЕСТИМОСТИ С simple-manager.js
    visualizeMergeEnhanced(footprint1, footprint2, comparisonResult, options = {}) {
        console.log('⚡ Использую совместимую версию visualizeMergeEnhanced');
        return this.visualizeMergedResult(
            footprint1,
            footprint2,
            comparisonResult,
            {
                outputPath: options.outputPath,
                showStats: options.showStats !== false,
                showConfidence: true,
                showLegend: true,
                title: options.title || 'ОБЪЕДИНЕНИЕ СЛЕДОВ РОБОФЛО'
            }
        );
    }

    // 2. ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕННОГО РЕЗУЛЬТАТА (ГЛАВНЫЙ МЕТОД)
    async visualizeMergedResult(footprint1, footprint2, comparisonResult = null, options = {}) {
        console.log('🎯 Создаю визуализацию ОБЪЕДИНЕННОГО РЕЗУЛЬТАТА...');

        try {
            const {
                outputPath = null,
                showStats = true,
                showLegend = true,
                showConfidence = true,
                title = 'ОБЪЕДИНЕННЫЙ СЛЕД РОБОФЛО'
            } = options;

            // 🔴 ШАГ 1: ИЗВЛЕЧЬ ДАННЫЕ ИЗ ОТПЕЧАТКОВ
            const points1 = this.extractPointsWithConfidence(footprint1);
            const points2 = this.extractPointsWithConfidence(footprint2);

            console.log(`📊 Точек в следах: ${points1.length} + ${points2.length}`);

            // 🔴 ШАГ 2: ВЫЧИСЛИТЬ ТРАНСФОРМАЦИЮ
            let transformationResult = null;
            if (points1.length > 3 && points2.length > 3) {
                const vectorComparison = this.compareWithVectorGraphs(points1, points2);
                transformationResult = vectorComparison.transformation;
            }

            // 🔴 ШАГ 3: ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ И СОВМЕСТИТЬ
            const transformedPoints2 = transformationResult
                ? this.applyTransformation(points2, transformationResult)
                : points2;

            // 🔴 ШАГ 4: ОБЪЕДИНИТЬ ТОЧКИ (СИМУЛЯЦИЯ МЕРЖА)
            const mergedResult = this.mergePointsWithConfidence(points1, transformedPoints2);
           
            console.log(`🔗 Результат объединения:`);
            console.log(`   ✅ Подтвержденные: ${mergedResult.confirmedPoints.length} (ядро)`);
            console.log(`   🔍 Новые из 1: ${mergedResult.newPointsFrom1.length}`);
            console.log(`   🔍 Новые из 2: ${mergedResult.newPointsFrom2.length}`);
            console.log(`   📊 Всего в объединенном: ${mergedResult.allPoints.length}`);

            // 🔴 ШАГ 5: СОЗДАТЬ ВИЗУАЛИЗАЦИЮ
            const canvas = createCanvas(1400, 900);
            const ctx = canvas.getContext('2d');

            // Фон
            this.drawBackground(ctx, canvas.width, canvas.height);

            // Заголовок
            this.drawTitle(ctx, title, 700, 60);

            // Область визуализации
            const vizArea = { x: 50, y: 120, width: 900, height: 700 };
            this.drawVisualizationArea(ctx, vizArea);

            // Нормализация
            const { scale, offsetX, offsetY } = this.normalizePoints(
                mergedResult.allPoints,
                vizArea
            );

            // 🔴 ОТРИСОВАТЬ ОБЪЕДИНЕННЫЙ СЛЕД
            this.drawMergedFootprint(ctx, mergedResult, scale, offsetX, offsetY, showConfidence);

            // 🔴 ПОДПИСАТЬ СОВПАДЕНИЯ (зеленые линии между подтвержденными точками)
            if (mergedResult.matches.length > 0) {
                this.drawConfirmationLines(ctx, mergedResult.matches, scale, offsetX, offsetY);
            }

            // 🔴 ЛЕГЕНДА С ДЕТАЛЬНОЙ ИНФОРМАЦИЕЙ
            if (showLegend) {
                this.drawDetailedLegend(ctx, mergedResult, 1000, 150);
            }

            // 🔴 СТАТИСТИКА ОБЪЕДИНЕНИЯ
            if (showStats) {
                const stats = this.calculateMergeStats(mergedResult, comparisonResult, transformationResult);
                this.drawStatistics(ctx, stats, 1000, 350);
            }

            // 🔴 КАРТА УВЕРЕННОСТИ (тепловая карта)
            if (showConfidence) {
                this.drawConfidenceHeatmap(ctx, mergedResult.allPoints, vizArea, scale, offsetX, offsetY);
            }

            // 🔴 ИНФОРМАЦИЯ О ТРАНСФОРМАЦИИ
            if (transformationResult && transformationResult.confidence > 0.3) {
                this.drawTransformationInfo(ctx, transformationResult, 1000, 500);
            }

            // 🔴 КАЧЕСТВО ОБЪЕДИНЕНИЯ
            this.drawMergeQuality(ctx, mergedResult, 1000, 600);

            // Сохранение
            if (outputPath) {
                const dir = path.dirname(outputPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                const buffer = canvas.toBuffer('image/png');
                fs.writeFileSync(outputPath, buffer);
                console.log(`✅ Визуализация объединенного следа сохранена: ${outputPath}`);
            }

            return {
                success: true,
                canvas,
                buffer: canvas.toBuffer('image/png'),
                stats: this.calculateMergeStats(mergedResult, comparisonResult, transformationResult),
                mergedResult: mergedResult,
                transformation: transformationResult
            };

        } catch (error) {
            console.log(`❌ Ошибка визуализации объединения: ${error.message}`);
            console.error(error.stack);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 🔴 3. ОБЪЕДИНЕНИЕ ТОЧЕК С УЧЕТОМ ПОДТВЕРЖДЕНИЙ
    mergePointsWithConfidence(points1, points2, matchThreshold = 15) {
        const confirmedPoints = [];  // ✅ Совпали в обоих следах
        const newPointsFrom1 = [];   // 🔍 Были только в следе 1
        const newPointsFrom2 = [];   // 🔍 Были только в следе 2
        const matches = [];         // Связи между совпавшими точками
        const usedPoints2 = new Set();

        // 🔍 Ищем совпадения
        points1.forEach(p1 => {
            let bestMatch = null;
            let bestDistance = Infinity;
            let bestIndex = -1;

            points2.forEach((p2, j) => {
                if (usedPoints2.has(j)) return;

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < matchThreshold && distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = p2;
                    bestIndex = j;
                }
            });

            if (bestMatch && bestDistance < matchThreshold) {
                // ✅ СОВПАДЕНИЕ - точка подтвердилась
                const confirmedPoint = {
                    ...p1,
                    x: (p1.x + bestMatch.x) / 2, // Среднее положение
                    y: (p1.y + bestMatch.y) / 2,
                    confidence: Math.max(p1.confidence || 0.5, bestMatch.confidence || 0.5),
                    confirmationCount: (p1.confirmationCount || 1) + (bestMatch.confirmationCount || 1),
                    source: 'confirmed',
                    originalPoints: [p1, bestMatch]
                };

                confirmedPoints.push(confirmedPoint);
                matches.push({
                    point1: p1,
                    point2: bestMatch,
                    distance: bestDistance,
                    mergedPoint: confirmedPoint
                });

                usedPoints2.add(bestIndex);
            } else {
                // 🔍 НОВАЯ ТОЧКА ИЗ СЛЕДА 1
                newPointsFrom1.push({
                    ...p1,
                    source: 'new_from_1',
                    confirmationCount: p1.confirmationCount || 1
                });
            }
        });

        // 🔍 НОВЫЕ ТОЧКИ ИЗ СЛЕДА 2 (которые не совпали)
        points2.forEach((p2, j) => {
            if (!usedPoints2.has(j)) {
                newPointsFrom2.push({
                    ...p2,
                    source: 'new_from_2',
                    confirmationCount: p2.confirmationCount || 1
                });
            }
        });

        // 🔗 ВСЕ ТОЧКИ ОБЪЕДИНЕННОГО СЛЕДА
        const allPoints = [
            ...confirmedPoints,
            ...newPointsFrom1,
            ...newPointsFrom2
        ];

        return {
            confirmedPoints,
            newPointsFrom1,
            newPointsFrom2,
            matches,
            allPoints,
            totalConfirmed: confirmedPoints.length,
            totalNew: newPointsFrom1.length + newPointsFrom2.length
        };
    }

    // 🔴 4. ИЗВЛЕЧЬ ТОЧКИ С ДАННЫМИ О ПОДТВЕРЖДЕНИИ
    extractPointsWithConfidence(footprint) {
        const points = [];

        // 1. Из трекера точек (если есть данные о подтверждениях)
        if (footprint.hybridFootprint?.pointTracker) {
            const trackerPoints = footprint.hybridFootprint.pointTracker.getAllPoints();
            trackerPoints.forEach(pt => {
                points.push({
                    x: pt.x,
                    y: pt.y,
                    confidence: pt.confidence || 0.5,
                    confirmationCount: pt.confirmedCount || 1,
                    source: 'tracker',
                    id: pt.id,
                    originalPoint: pt
                });
            });
        }

        // 2. Из графа
        if (footprint.graph && points.length === 0) {
            Array.from(footprint.graph.nodes.values()).forEach(n => {
                points.push({
                    x: n.x,
                    y: n.y,
                    confidence: n.confidence || 0.5,
                    confirmationCount: 1, // базовое подтверждение
                    source: 'graph',
                    id: n.id
                });
            });
        }

        // 3. Из оригинальных точек
        if (footprint.originalPoints && points.length === 0) {
            footprint.originalPoints.forEach((pt, idx) => {
                points.push({
                    x: pt.x,
                    y: pt.y,
                    confidence: pt.confidence || 0.5,
                    confirmationCount: 1,
                    source: 'original',
                    id: `pt_${idx}`
                });
            });
        }

        console.log(`📥 Извлечено ${points.length} точек из ${footprint.name}`);
        return points;
    }

    // 🔴 5. ОТРИСОВКА ОБЪЕДИНЕННОГО СЛЕДА
    drawMergedFootprint(ctx, mergedResult, scale, offsetX, offsetY, showConfidence = true) {
        // 🔴 1. ПОДТВЕРЖДЕННЫЕ ТОЧКИ (ядро - ЗЕЛЕНЫЙ)
        mergedResult.confirmedPoints.forEach(point => {
            const x = offsetX + point.x * scale;
            const y = offsetY + point.y * scale;
           
            const size = 5 + Math.min(point.confirmationCount, 5); // Размер зависит от подтверждений
            const color = this.getConfirmationColor(point.confirmationCount);
           
            // Точка
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
           
            // Белое ядро
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
            ctx.fill();
           
            // Подпись с количеством подтверждений
            if (showConfidence && point.confirmationCount > 1) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`✓${point.confirmationCount}`, x, y - size - 3);
                ctx.textAlign = 'left';
            }
        });

        // 🔴 2. НОВЫЕ ТОЧКИ ИЗ СЛЕДА 1 (СИНИЙ)
        mergedResult.newPointsFrom1.forEach(point => {
            const x = offsetX + point.x * scale;
            const y = offsetY + point.y * scale;
           
            ctx.fillStyle = 'rgba(50, 100, 255, 0.7)';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
           
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
           
            // Подпись "новое"
            if (showConfidence) {
                ctx.fillStyle = 'rgba(50, 100, 255, 0.9)';
                ctx.font = '10px Arial';
                ctx.fillText('+1', x + 6, y - 6);
            }
        });

        // 🔴 3. НОВЫЕ ТОЧКИ ИЗ СЛЕДА 2 (КРАСНЫЙ)
        mergedResult.newPointsFrom2.forEach(point => {
            const x = offsetX + point.x * scale;
            const y = offsetY + point.y * scale;
           
            ctx.fillStyle = 'rgba(255, 50, 50, 0.7)';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
           
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
           
            if (showConfidence) {
                ctx.fillStyle = 'rgba(255, 50, 50, 0.9)';
                ctx.font = '10px Arial';
                ctx.fillText('+2', x + 6, y - 6);
            }
        });
    }

    // 🔴 6. ЦВЕТ В ЗАВИСИМОСТИ ОТ КОЛИЧЕСТВА ПОДТВЕРЖДЕНИЙ
    getConfirmationColor(count) {
        if (count >= 3) return 'rgba(0, 200, 83, 0.9)';    // Высокая уверенность - зеленый
        if (count === 2) return 'rgba(156, 39, 176, 0.8)'; // Средняя - фиолетовый
        return 'rgba(255, 152, 0, 0.7)';                   // Низкая - оранжевый
    }

    // 🔴 7. ЛИНИИ ПОДТВЕРЖДЕНИЯ МЕЖДУ СОВПАВШИМИ ТОЧКАМИ
    drawConfirmationLines(ctx, matches, scale, offsetX, offsetY) {
        ctx.strokeStyle = 'rgba(0, 200, 83, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);

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

    // 🔴 8. ДЕТАЛЬНАЯ ЛЕГЕНДА
    drawDetailedLegend(ctx, mergedResult, x, y) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('📋 ЛЕГЕНДА ОБЪЕДИНЕННОГО СЛЕДА', x, y);

        y += 35;
        ctx.font = '14px Arial';

        const legendItems = [
            { color: 'rgba(0, 200, 83, 0.9)', text: `✅ Ядро (подтверждено) - ${mergedResult.confirmedPoints.length} точек` },
            { color: 'rgba(50, 100, 255, 0.7)', text: `🔍 Новые из следа 1 - ${mergedResult.newPointsFrom1.length}` },
            { color: 'rgba(255, 50, 50, 0.7)', text: `🔍 Новые из следа 2 - ${mergedResult.newPointsFrom2.length}` },
            { color: 'rgba(0, 200, 83, 0.4)', text: '📐 Линии подтверждения' },
            { text: '✓3+ - подтверждено 3+ раза', color: 'rgba(0, 200, 83, 0.9)' },
            { text: '✓2 - подтверждено 2 раза', color: 'rgba(156, 39, 176, 0.8)' },
            { text: '✓1 - первое обнаружение', color: 'rgba(255, 152, 0, 0.7)' }
        ];

        legendItems.forEach((item, index) => {
            if (item.color) {
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.arc(x + 10, y + 5, 6, 0, Math.PI * 2);
                ctx.fill();
            }
           
            ctx.fillStyle = '#cccccc';
            ctx.fillText(item.text, x + 25, y + 10);
            y += 25;
        });
    }

    // 🔴 9. СТАТИСТИКА ОБЪЕДИНЕНИЯ
    calculateMergeStats(mergedResult, comparisonResult, transformationResult) {
        const totalPoints = mergedResult.allPoints.length;
        const confirmedPercent = totalPoints > 0
            ? Math.round((mergedResult.confirmedPoints.length / totalPoints) * 100)
            : 0;

        const avgConfirmations = mergedResult.confirmedPoints.length > 0
            ? (mergedResult.confirmedPoints.reduce((sum, p) => sum + (p.confirmationCount || 1), 0) / mergedResult.confirmedPoints.length).toFixed(1)
            : 0;

        return {
            totalPoints,
            confirmedPoints: mergedResult.confirmedPoints.length,
            newPoints: mergedResult.totalNew,
            confirmedPercent,
            avgConfirmations,
            matches: mergedResult.matches.length,
            transformation: transformationResult ? 'Применена' : 'Нет',
            transformationConfidence: transformationResult?.confidence?.toFixed(3) || 'N/A',
            similarity: comparisonResult?.similarity?.toFixed(3) || 'N/A',
            quality: this.calculateMergeQuality(mergedResult)
        };
    }

    drawStatistics(ctx, stats, x, y) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('📊 СТАТИСТИКА ОБЪЕДИНЕНИЯ', x, y);

        y += 35;
        ctx.font = '14px Arial';
        ctx.fillStyle = '#cccccc';

        const statItems = [
            `📈 Всего точек: ${stats.totalPoints}`,
            `✅ Подтвержденных: ${stats.confirmedPoints} (${stats.confirmedPercent}%)`,
            `🔍 Новых деталей: ${stats.newPoints}`,
            `📐 Среднее подтверждений: ${stats.avgConfirmations}`,
            `🔗 Совпадений: ${stats.matches}`,
            `🔄 Трансформация: ${stats.transformation}`,
            `🎯 Качество объединения: ${stats.quality}/100`
        ];

        statItems.forEach((item, index) => {
            ctx.fillText(item, x, y + index * 25);
        });
    }

    // 🔴 10. КАРТА УВЕРЕННОСТИ
    drawConfidenceHeatmap(ctx, points, vizArea, scale, offsetX, offsetY) {
        // Создаем градиенты уверенности
        points.forEach(point => {
            const x = offsetX + point.x * scale;
            const y = offsetY + point.y * scale;
           
            const confidence = point.confidence || 0.5;
            const radius = 15 * confidence;
           
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, `rgba(0, 200, 83, ${0.3 * confidence})`);
            gradient.addColorStop(1, 'rgba(0, 200, 83, 0)');
           
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // 🔴 11. КАЧЕСТВО ОБЪЕДИНЕНИЯ
    calculateMergeQuality(mergedResult) {
        if (mergedResult.allPoints.length === 0) return 0;
       
        const confirmedRatio = mergedResult.confirmedPoints.length / mergedResult.allPoints.length;
        const matchRatio = mergedResult.matches.length / Math.max(mergedResult.confirmedPoints.length, 1);
       
        // Качество от 0 до 100
        let quality = (confirmedRatio * 60) + (matchRatio * 40);
       
        // Бонус за множество подтверждений
        if (mergedResult.confirmedPoints.length > 10) quality += 10;
        if (mergedResult.confirmedPoints.length > 20) quality += 10;
       
        return Math.min(Math.round(quality), 100);
    }

    drawMergeQuality(ctx, mergedResult, x, y) {
        const quality = this.calculateMergeQuality(mergedResult);
       
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('🏆 КАЧЕСТВО ОБЪЕДИНЕНИЯ', x, y);
       
        y += 30;
       
        // Полоска качества
        const barWidth = 300;
        const barHeight = 20;
        const filledWidth = (barWidth * quality) / 100;
       
        // Фон
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x, y, barWidth, barHeight);
       
        // Заполнение (цвет в зависимости от качества)
        let fillColor;
        if (quality >= 80) fillColor = 'rgba(0, 200, 83, 0.8)';
        else if (quality >= 60) fillColor = 'rgba(255, 152, 0, 0.8)';
        else fillColor = 'rgba(255, 50, 50, 0.8)';
       
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, filledWidth, barHeight);
       
        // Текст
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`${quality}%`, x + barWidth / 2 - 15, y + barHeight / 2 + 5);
    }

    // 🔴 12. СИМУЛЯЦИЯ ПРОЦЕССА ОБЪЕДИНЕНИЯ (для обратной совместимости)
    simulateMergeProcess(points1, points2) {
        const mergedResult = this.mergePointsWithConfidence(points1, points2);
        return {
            mergedPoints: mergedResult.allPoints,
            matchedPoints: mergedResult.confirmedPoints,
            newPointsFrom1: mergedResult.newPointsFrom1,
            newPointsFrom2: mergedResult.newPointsFrom2,
            matches: mergedResult.matches
        };
    }

    // 🔴 13. СОЗДАТЬ ОПИСАНИЕ ДЛЯ TELEGRAM
    createMergeCaption(footprint1, footprint2, stats) {
        return `<b>🎯 ОБЪЕДИНЕННЫЙ СЛЕД РОБОФЛО</b>\n\n` +
               `<b>📸 ${footprint1.name}:</b> + ${footprint2.name}\n` +
               `<b>✅ Подтвержденных деталей:</b> ${stats.confirmedPoints} (${stats.confirmedPercent}%)\n` +
               `<b>🔍 Новых деталей:</b> ${stats.newPoints}\n` +
               `<b>📈 Среднее подтверждений:</b> ${stats.avgConfirmations} раз\n` +
               `<b>🎯 Качество объединения:</b> ${stats.quality}/100\n` +
               `<b>🔄 Трансформация:</b> ${stats.transformation}\n\n` +
               `<i>✅ Ядро | 🔍 Новые | 📐 Подтверждения</i>`;
    }

    // 🔴 14. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (из предыдущей версии, оставляем для совместимости)

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

            const pointMatches = (vectorComparison.pointMatches || []).map(match => {
                const point1 = points1[match.pointA];
                const point2 = points2[match.pointB];
               
                if (!point1 || !point2) return null;
               
                return {
                    point1: point1,
                    point2: point2,
                    distance: match.distance || 0,
                    score: match.score || 0
                };
            }).filter(match => match !== null);

            console.log(`🔗 Преобразовано ${pointMatches.length} векторных соответствий`);

            return {
                transformation: vectorComparison.transformation,
                pointMatches: pointMatches,
                similarity: vectorComparison.similarity,
                vectorComparison: vectorComparison
            };

        } catch (error) {
            console.log('⚠️ Ошибка векторного сравнения:', error.message);
            return { transformation: null, pointMatches: [], similarity: 0 };
        }
    }

    applyTransformation(points, transformation) {
        if (!transformation || transformation.type === 'insufficient_points') {
            return points;
        }

        return points.map(p => {
            let x = p.x;
            let y = p.y;

            x += transformation.translation?.dx || 0;
            y += transformation.translation?.dy || 0;

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

    drawBackground(ctx, width, height) {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.5, '#16213e');
        gradient.addColorStop(1, '#0f3460');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        const gridSize = 20;
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

    drawTitle(ctx, title, x, y) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(title, x, y);
        ctx.textAlign = 'left';
    }

    drawVisualizationArea(ctx, area) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.strokeRect(area.x, area.y, area.width, area.height);
       
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(area.x, area.y, area.width, area.height);
    }

    normalizePoints(points, area) {
        if (points.length === 0) {
            return { scale: 1, offsetX: area.x + area.width/2, offsetY: area.y + area.height/2 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        points.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });

        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;

        const scale = Math.min(
            (area.width - 40) / rangeX,
            (area.height - 40) / rangeY
        );

        const offsetX = area.x + (area.width - rangeX * scale) / 2 - minX * scale;
        const offsetY = area.y + (area.height - rangeY * scale) / 2 - minY * scale;

        return { scale, offsetX, offsetY };
    }

    drawTransformationInfo(ctx, transformation, x, y) {
        ctx.fillStyle = 'rgba(0, 200, 83, 0.9)';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('🔄 ТРАНСФОРМАЦИЯ ПРИМЕНЕНА:', x, y);

        y += 25;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '14px Arial';

        if (transformation.translation) {
            ctx.fillText(`↔ Смещение: dx=${transformation.translation.dx?.toFixed(2) || 0}, dy=${transformation.translation.dy?.toFixed(2) || 0}`, x, y);
            y += 20;
        }
       
        if (transformation.rotation) {
            ctx.fillText(`↻ Поворот: ${transformation.rotation?.toFixed(2) || 0}°`, x, y);
            y += 20;
        }
       
        if (transformation.scale && transformation.scale !== 1) {
            ctx.fillText(`⚖ Масштаб: ${transformation.scale?.toFixed(3) || 1}`, x, y);
            y += 20;
        }
       
        ctx.fillText(`🎯 Уверенность: ${transformation.confidence?.toFixed(3) || 0}`, x, y);
    }
}

module.exports = MergeVisualizer;
