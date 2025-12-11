// modules/footprint/merge-visualizer.js - ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const VectorGraph = require('./vector-graph'); // 🔴 ДОБАВЛЕНО ДЛЯ ВЕКТОРНЫХ СХЕМ

class MergeVisualizer {
    constructor() {
        console.log('🎨 Создан улучшенный визуализатор объединений с векторными схемами');
    }

    // 1. ОСНОВНОЙ МЕТОД ДЛЯ СОВМЕСТИМОСТИ
    visualizeMerge(footprint1, footprint2, comparisonResult, outputPath = null) {
        // Используем улучшенную версию для совместимости
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

    // 2. УЛУЧШЕННАЯ ВИЗУАЛИЗАЦИЯ С ТРАНСФОРМАЦИЕЙ
    async visualizeMergeEnhanced(footprint1, footprint2, comparisonResult = null, options = {}) {
        console.log('🎨 Создаю ВЕКТОРНУЮ визуализацию объединения...');

        try {
            // Настройки
            const {
                showTransformation = true,
                showWeights = true,
                showConnections = true,
                showStats = true,
                outputPath = null,
                title = 'ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ С ВЕКТОРНЫМИ СХЕМАМИ',
                transformation = null, // 🔴 МОЖНО ПЕРЕДАТЬ ГОТОВУЮ ТРАНСФОРМАЦИЮ
                vectorMatches = null  // 🔴 ИЛИ ГОТОВЫЕ СООТВЕТСТВИЯ
            } = options;

            // Получить точки из обоих отпечатков
            const points1 = this.extractPoints(footprint1);
            const points2 = this.extractPoints(footprint2);

            console.log(`📊 Точки: ${points1.length} из ${footprint1.name}, ${points2.length} из ${footprint2.name}`);

            // 🔴 ШАГ 1: ВЕКТОРНОЕ СРАВНЕНИЕ (ТОПОЛОГИЧЕСКОЕ)
            let transformationResult = transformation;
            let matchesResult = vectorMatches;

            // Если трансформация не передана, вычисляем её через векторные схемы
            if (!transformationResult && points1.length > 3 && points2.length > 3) {
                console.log('🔍 Выполняю векторное сравнение для трансформации...');
                const vectorComparison = this.compareWithVectorGraphs(points1, points2);
                transformationResult = vectorComparison.transformation;
                matchesResult = vectorComparison.pointMatches;
               
                // 🔴 ДОБАВЛЕНО: ЛОГИРОВАНИЕ ФОРМАТА СОВПАДЕНИЙ
                console.log(`📊 Формат совпадений: ${matchesResult.length > 0 ?
                    (matchesResult[0].point1 ? 'точки' : 'индексы') : 'нет'}`);
               
                // Проверить первые 3 совпадения
                if (matchesResult.length > 0) {
                    console.log('🔍 Пример совпадения:', JSON.stringify(matchesResult[0]).slice(0, 100));
                }
            }

            // 🔴 ШАГ 2: ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ К ТОЧКАМ ВТОРОГО СЛЕДА
            const transformedPoints2 = transformationResult
                ? this.applyTransformation(points2, transformationResult)
                : points2;

            // 🔴 ШАГ 3: НАЙТИ СОВПАДЕНИЯ ПОСЛЕ ТРАНСФОРМАЦИИ
            const finalMatches = matchesResult || this.findPointMatches(
                points1,
                transformedPoints2,
                10 // малый порог, т.к. следы уже выровнены
            );

            console.log(`🔗 Найдено ${finalMatches.length} топологических соответствий`);

            // Создать канвас
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
            const { scale, offsetX, offsetY } = this.normalizePoints(
                [...points1, ...transformedPoints2],
                vizArea
            );

            // Связи между совпавшими точками
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

            // Точки второго следа (трансформированные)
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

    // 🔴 3. ВЕКТОРНОЕ СРАВНЕНИЕ ДЛЯ ТРАНСФОРМАЦИИ (ИСПРАВЛЕННЫЙ)
    compareWithVectorGraphs(points1, points2) {
        if (points1.length < 4 || points2.length < 4) {
            return {
                transformation: null,
                pointMatches: [],
                similarity: 0
            };
        }

        try {
            // Создать векторные схемы
            const vectorGraph1 = new VectorGraph({ points: points1 });
            const vectorGraph2 = new VectorGraph({ points: points2 });

            vectorGraph1.createFromPoints(points1);
            vectorGraph2.createFromPoints(points2);

            // Сравнить векторные схемы
            const vectorComparison = vectorGraph1.compare(vectorGraph2);

            // 🔴 ИСПРАВЛЕНИЕ: ПРЕОБРАЗОВАТЬ ИНДЕКСЫ В ТОЧКИ
            const pointMatches = (vectorComparison.pointMatches || []).map(match => {
                const point1 = points1[match.pointA];
                const point2 = points2[match.pointB];
               
                if (!point1 || !point2) {
                    return null;
                }
               
                return {
                    point1: point1,
                    point2: point2,
                    distance: match.distance || 0,
                    score: match.score || 0,
                    originalMatch: match // сохраняем оригинальные данные
                };
            }).filter(match => match !== null); // убираем null

            console.log(`🔗 Преобразовано ${pointMatches.length} векторных соответствий в точки`);

            return {
                transformation: vectorComparison.transformation,
                pointMatches: pointMatches, // 🔴 ТЕПЕРЬ ЭТО ТОЧКИ, А НЕ ИНДЕКСЫ
                similarity: vectorComparison.similarity,
                vectorComparison: vectorComparison
            };

        } catch (error) {
            console.log('⚠️ Ошибка векторного сравнения:', error.message);
            return {
                transformation: null,
                pointMatches: [],
                similarity: 0
            };
        }
    }

    // 🔴 4. ВЕС ТОЧКИ НА ОСНОВЕ СОВПАДЕНИЙ
    calculatePointWeight(point, matches, pointIndex, footprintType) {
        let weight = 1; // Базовая точка

        // Проверить, есть ли эта точка в совпадениях
        const match = matches.find(m =>
            footprintType === 'first' ? m.point1 === point : m.point2 === point
        );

        if (match) {
            weight = 2; // Совпавшая точка

            // Если расстояние очень маленькое, увеличиваем вес
            if (match.distance < 5) {
                weight = 3; // Идеальное совпадение
            }
        }

        return weight;
    }

    // 🔴 5. ИЗВЛЕЧЬ ТОЧКИ ИЗ ОТПЕЧАТКА
    extractPoints(footprint) {
        // Сначала попробовать из трекера точек
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

        // Иначе из оригинальных точек или графа
        return footprint.originalPoints ||
               (footprint.graph ?
                Array.from(footprint.graph.nodes.values()).map(n => ({
                    x: n.x,
                    y: n.y,
                    confidence: n.confidence || 0.5
                })) : []);
    }

    // 🔴 6. ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ
    applyTransformation(points, transformation) {
        if (!transformation || transformation.type === 'insufficient_points') {
            return points;
        }

        return points.map(p => {
            let x = p.x;
            let y = p.y;

            // Применяем смещение
            x += transformation.translation?.dx || 0;
            y += transformation.translation?.dy || 0;

            // Применяем поворот (если есть)
            if (transformation.rotation && transformation.rotation !== 0) {
                const rad = transformation.rotation * Math.PI / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const newX = x * cos - y * sin;
                const newY = x * sin + y * cos;
                x = newX;
                y = newY;
            }

            // Применяем масштаб (если есть)
            if (transformation.scale && transformation.scale !== 1) {
                x *= transformation.scale;
                y *= transformation.scale;
            }

            return { ...p, x, y };
        });
    }

    // 🔴 7. ПОИСК СОВПАДЕНИЙ (геометрический, после трансформации)
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

    // 🔴 8. МЕТОДЫ ОТРИСОВКИ

    drawBackground(ctx, width, height) {
        // Градиентный фон
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(0.5, '#16213e');
        gradient.addColorStop(1, '#0f3460');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Сетка
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

    drawTitle(ctx, title, name1, name2) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(title, 600, 60);
       
        ctx.font = '20px Arial';
        ctx.fillText(`🔵 ${name1}  vs  🔴 ${name2}`, 600, 100);
       
        ctx.textAlign = 'left';
    }

    drawVisualizationArea(ctx, area) {
        // Рамка
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.strokeRect(area.x, area.y, area.width, area.height);
       
        // Фон
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(area.x, area.y, area.width, area.height);
    }

    normalizePoints(points, area) {
        if (points.length === 0) {
            return { scale: 1, offsetX: area.x + area.width/2, offsetY: area.y + area.height/2 };
        }

        // Найти границы
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

        // Масштаб с отступами
        const scale = Math.min(
            (area.width - 40) / rangeX,
            (area.height - 40) / rangeY
        );

        // Центрирование
        const offsetX = area.x + (area.width - rangeX * scale) / 2 - minX * scale;
        const offsetY = area.y + (area.height - rangeY * scale) / 2 - minY * scale;

        return { scale, offsetX, offsetY };
    }

    // 🔴 ИСПРАВЛЕННЫЙ: drawConnections с защитой от разных форматов данных
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
            // 🔴 ПРОВЕРКА ВСЕХ ВОЗМОЖНЫХ ФОРМАТОВ:
            let p1, p2;
           
            if (match.point1 && match.point2) {
                p1 = match.point1;
                p2 = match.point2;
            } else if (match.pointA !== undefined && match.pointB !== undefined) {
                // Если переданы индексы вместо точек
                p1 = points1[match.pointA];
                p2 = points2[match.pointB];
            } else {
                console.log(`⚠️ Пропускаю невалидное совпадение ${index}:`, match);
                return;
            }
           
            // Проверка координат
            if (!p1 || !p2 ||
                typeof p1.x === 'undefined' || typeof p1.y === 'undefined' ||
                typeof p2.x === 'undefined' || typeof p2.y === 'undefined') {
                console.log(`⚠️ Пропускаю совпадение ${index} без координат`);
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
            console.log(`✅ Нарисовано ${validConnections} связей между точками`);
        }
    }

    drawPoint(ctx, x, y, color, size, label = '') {
        // Внешний круг
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        // Внутренний круг
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Метка
        if (label) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(label, x, y - size - 5);
            ctx.textAlign = 'left';
        }
    }

    getPointColor(weight, isSecondFootprint) {
        if (weight >= 3) {
            return 'rgba(0, 200, 83, 0.9)'; // Ядро - зеленый
        } else if (weight === 2) {
            return 'rgba(156, 39, 176, 0.8)'; // Совпадение - фиолетовый
        } else {
            return isSecondFootprint
                ? 'rgba(255, 50, 50, 0.7)'  // Второй след - красный
                : 'rgba(50, 100, 255, 0.7)'; // Первый след - синий
        }
    }

    calculateStats(points1, points2, matches, comparisonResult, transformationResult) {
        const matchRate = matches.length > 0
            ? Math.round((matches.length / Math.min(points1.length, points2.length)) * 100)
            : 0;

        const avgDistance = matches.length > 0
            ? matches.reduce((sum, m) => sum + m.distance, 0) / matches.length
            : 0;

        return {
            points1: points1.length,
            points2: points2.length,
            matches: matches.length,
            matchRate: matchRate,
            avgDistance: avgDistance.toFixed(2),
            similarity: comparisonResult?.similarity?.toFixed(3) || 'N/A',
            decision: comparisonResult?.decision || 'N/A',
            transformation: transformationResult ? 'Есть' : 'Нет',
            transformationConfidence: transformationResult?.confidence?.toFixed(3) || 'N/A'
        };
    }

    drawStatistics(ctx, stats, x, y) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('📊 СТАТИСТИКА', x, y);

        y += 30;
        ctx.font = '14px Arial';
       
        const statItems = [
            `📏 Точек след 1: ${stats.points1}`,
            `📏 Точек след 2: ${stats.points2}`,
            `🔗 Соответствий: ${stats.matches} (${stats.matchRate}%)`,
            `📐 Среднее расстояние: ${stats.avgDistance}`,
            `💎 Схожесть: ${stats.similarity}`,
            `🤔 Решение: ${stats.decision}`,
            `🔄 Трансформация: ${stats.transformation}`,
            `🎯 Уверенность трансформации: ${stats.transformationConfidence}`
        ];

        statItems.forEach((item, index) => {
            ctx.fillText(item, x, y + index * 25);
        });
    }

    drawLegend(ctx, count1, count2, matchesCount) {
        let startY = 700; // ИСПРАВЛЕНО: let вместо const

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
                startY += 25;
            }
        });
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

    // 9. СОЗДАТЬ ОПИСАНИЕ ДЛЯ TELEGRAM
    createMergeCaption(footprint1, footprint2, stats) {
        const matchRate = stats.matches > 0
            ? Math.round((stats.matches / Math.min(stats.points1, stats.points2)) * 100)
            : 0;

        return `<b>🎭 ВЕКТОРНАЯ ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ</b>\n\n` +
               `<b>📸 ${footprint1.name}:</b> ${stats.points1} точек\n` +
               `<b>📸 ${footprint2.name}:</b> ${stats.points2} точек\n` +
               `<b>🔗 Топологических соответствий:</b> ${stats.matches} (${matchRate}%)\n` +
               `<b>🔄 Трансформация:</b> ${stats.transformation ? 'есть' : 'нет'}\n` +
               `<b>💎 Схожесть:</b> ${stats.similarity?.toFixed(3) || 'N/A'}\n` +
               `<b>🤔 Решение:</b> ${stats.decision || 'N/A'}\n\n` +
               `<i>🔵 ${footprint1.name} | 🔴 ${footprint2.name} | 🟣 Совпадения | 🟢 Ядро</i>`;
    }
}

module.exports = MergeVisualizer;
