// modules/footprint/merge-visualizer.js - ПОЛНЫЙ КОД С ИСПРАВЛЕННЫМ НАЛОЖЕНИЕМ
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

    // 2. МЕТОД ДЛЯ СОВМЕСТИМОСТИ С simple-manager.js
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
                title: options.title || 'НАЛОЖЕНИЕ СЛЕДОВ ПО ОПОРНЫМ ТОЧКАМ'
            }
        );
    }

    // 3. ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕННОГО РЕЗУЛЬТАТА (ГЛАВНЫЙ МЕТОД)
    async visualizeMergedResult(footprint1, footprint2, comparisonResult = null, options = {}) {
        console.log('🎯 Создаю визуализацию НАЛОЖЕНИЯ следов по опорным точкам...');

        try {
            const {
                outputPath = null,
                showStats = true,
                showLegend = true,
                showConfidence = true,
                title = 'НАЛОЖЕНИЕ СЛЕДОВ ПО ОПОРНЫМ ТОЧКАМ'
            } = options;

            // 🔴 ШАГ 1: ИЗВЛЕЧЬ ДАННЫЕ ИЗ ОТПЕЧАТКОВ
            const points1 = this.extractPointsWithConfidence(footprint1);
            const points2 = this.extractPointsWithConfidence(footprint2);

            console.log(`📊 Точек в следах: ${points1.length} + ${points2.length}`);

            // 🔴 ШАГ 2: ПОЛУЧИТЬ ВЕКТОРНЫЕ СООТВЕТСТВИЯ
            let matches = [];
            let transformationResult = null;
            let rawPoints2 = points2; // Сохраняем исходные точки

            if (points1.length > 3 && points2.length > 3) {
                console.log('🔍 Получаю векторные соответствия...');
                const vectorComparison = this.compareWithVectorGraphs(points1, points2);
                matches = vectorComparison.pointMatches || [];
                transformationResult = vectorComparison.transformation;
               
                console.log(`🎯 Найдено ${matches.length} пар соответствий для трансформации`);
               
                // 🔴 ЕСЛИ ЕСТЬ СООТВЕТСТВИЯ - ВЫЧИСЛИТЬ ТОЧНУЮ ТРАНСФОРМАЦИЮ
                if (matches.length >= 3) {
                    // Метод вычисляет трансформацию по парам точек
                    const calculatedTransformation = this.calculateTransformationFromMatches(matches);
                    if (calculatedTransformation) {
                        transformationResult = calculatedTransformation;
                        console.log(`🔄 Рассчитана трансформация из ${matches.length} пар точек`);
                    } else {
                        console.log('⚠️ Не удалось рассчитать трансформацию, использую стандартную');
                    }
                } else {
                    console.log('⚠️ Недостаточно пар для точной трансформации (нужно минимум 3)');
                }
            }

            // 🔴 ШАГ 3: ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ КО ВСЕМ ТОЧКАМ ВТОРОГО СЛЕДА
            let transformedPoints2 = rawPoints2;
            if (transformationResult) {
                console.log('🔄 Применяю трансформацию ко всем точкам второго следа...');
                transformedPoints2 = this.applyTransformation(rawPoints2, transformationResult);
                console.log(`✅ Все ${transformedPoints2.length} точек второго следа трансформированы`);
               
                // Показать пример трансформации
                if (transformedPoints2.length > 0 && rawPoints2.length > 0) {
                    console.log(`📐 Пример точки: (${rawPoints2[0].x.toFixed(2)}, ${rawPoints2[0].y.toFixed(2)}) → ` +
                               `(${transformedPoints2[0].x.toFixed(2)}, ${transformedPoints2[0].y.toFixed(2)})`);
                }
            } else {
                console.log('⚠️ Трансформация не применена');
            }

            // 🔴 ШАГ 4: ОБЪЕДИНИТЬ УЖЕ ВЫРОВНЕННЫЕ ТОЧКИ
            console.log('🔗 Объединяю выровненные точки...');
            const mergedResult = this.mergePointsWithConfidence(points1, transformedPoints2, 15);
           
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

            // 🔴 ВАЖНО: ДЛЯ НОРМАЛИЗАЦИИ ИСПОЛЬЗУЕМ ТОЛЬКО ВЫРОВНЕННЫЕ ТОЧКИ
            const pointsForNormalization = [...points1, ...transformedPoints2];

            // Нормализация
            const { scale, offsetX, offsetY } = this.normalizePoints(
                pointsForNormalization,
                vizArea
            );

            // 🔴 ШАГ 6: ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ
            // 6a. Рисуем объединенный след (все точки в единой системе координат)
            this.drawMergedFootprint(ctx, mergedResult, scale, offsetX, offsetY, showConfidence);
           
            // 6b. 🔴 ГЛАВНОЕ: Рисуем линии между СОВПАВШИМИ ТОЧКАМИ (опорные точки)
            if (matches.length > 0) {
                this.drawMatchLines(ctx, matches, scale, offsetX, offsetY);
            }

            // 🔴 ЛЕГЕНДА С ДЕТАЛЬНОЙ ИНФОРМАЦИЕЙ
            if (showLegend) {
                this.drawDetailedLegend(ctx, mergedResult, matches.length, 1000, 150);
            }

            // 🔴 СТАТИСТИКА ОБЪЕДИНЕНИЯ
            if (showStats) {
                const stats = this.calculateMergeStats(mergedResult, comparisonResult, transformationResult, matches.length);
                this.drawStatistics(ctx, stats, 1000, 350);
            }

            // 🔴 ИНФОРМАЦИЯ О ТРАНСФОРМАЦИИ И СООТВЕТСТВИЯХ
            if (transformationResult) {
                this.drawTransformationInfo(ctx, transformationResult, matches.length, 1000, 500);
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
                console.log(`✅ Визуализация наложения сохранена: ${outputPath}`);
            }

            return {
                success: true,
                canvas,
                buffer: canvas.toBuffer('image/png'),
                stats: this.calculateMergeStats(mergedResult, comparisonResult, transformationResult, matches.length),
                mergedResult: mergedResult,
                matches: matches,
                transformation: transformationResult
            };

        } catch (error) {
            console.log(`❌ Ошибка визуализации наложения: ${error.message}`);
            console.error(error.stack);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 🔴 4. ВЫЧИСЛЕНИЕ ТРАНСФОРМАЦИИ ИЗ ПАР СООТВЕТСТВИЙ
    calculateTransformationFromMatches(matches) {
        if (!matches || matches.length < 3) {
            console.log('⚠️ Недостаточно пар для вычисления трансформации');
            return null;
        }

        try {
            console.log(`📐 Вычисляю трансформацию из ${matches.length} пар точек...`);
           
            // 1. Собираем массивы координат
            const sourcePoints = []; // Точки из второго следа (которые будем трансформировать)
            const targetPoints = []; // Точки из первого следа (целевые координаты)
           
            matches.forEach((match, index) => {
                if (match.point1 && match.point2) {
                    sourcePoints.push([match.point2.x, match.point2.y]); // Второй след -> к Первому
                    targetPoints.push([match.point1.x, match.point1.y]);
                   
                    if (index < 3) { // Логируем первые 3 пары для отладки
                        console.log(`   Пара ${index+1}: (${match.point2.x.toFixed(2)}, ${match.point2.y.toFixed(2)}) → ` +
                                   `(${match.point1.x.toFixed(2)}, ${match.point1.y.toFixed(2)})`);
                    }
                }
            });

            if (sourcePoints.length < 3) {
                console.log('⚠️ Недостаточно валидных пар координат');
                return null;
            }

            // 2. Вычисляем среднее смещение (translation)
            let sumDx = 0;
            let sumDy = 0;
           
            for (let i = 0; i < sourcePoints.length; i++) {
                sumDx += targetPoints[i][0] - sourcePoints[i][0];
                sumDy += targetPoints[i][1] - sourcePoints[i][1];
            }
           
            const avgDx = sumDx / sourcePoints.length;
            const avgDy = sumDy / sourcePoints.length;
           
            // 3. Вычисляем поворот и масштаб (используем метод наименьших квадратов для аффинного преобразования)
            let sumCos = 0;
            let sumSin = 0;
            let sumScale = 0;
            let validPairs = 0;
           
            // Используем первую точку как опорную
            const refPoint1 = sourcePoints[0];
            const refPoint2 = targetPoints[0];
           
            for (let i = 1; i < sourcePoints.length; i++) {
                const dx1 = sourcePoints[i][0] - refPoint1[0];
                const dy1 = sourcePoints[i][1] - refPoint1[1];
                const dx2 = targetPoints[i][0] - refPoint2[0];
                const dy2 = targetPoints[i][1] - refPoint2[1];
               
                const dist1 = Math.sqrt(dx1*dx1 + dy1*dy1);
                const dist2 = Math.sqrt(dx2*dx2 + dy2*dy2);
               
                if (dist1 > 10 && dist2 > 10) { // Игнорируем слишком близкие точки
                    // Вычисляем угол между векторами
                    const cosAngle = (dx1*dx2 + dy1*dy2) / (dist1 * dist2);
                    const sinAngle = (dx1*dy2 - dy1*dx2) / (dist1 * dist2);
                   
                    sumCos += cosAngle;
                    sumSin += sinAngle;
                    sumScale += dist2 / dist1;
                    validPairs++;
                }
            }
           
            let angle = 0;
            let scale = 1;
           
            if (validPairs > 0) {
                const avgCos = sumCos / validPairs;
                const avgSin = sumSin / validPairs;
                scale = sumScale / validPairs;
               
                // Угол в градусах
                angle = Math.atan2(avgSin, avgCos) * 180 / Math.PI;
               
                // Ограничиваем масштаб разумными пределами
                scale = Math.max(0.5, Math.min(2.0, scale));
            }
           
            console.log(`📐 Рассчитано по ${sourcePoints.length} парам:`);
            console.log(`   Смещение: dx=${avgDx.toFixed(2)}, dy=${avgDy.toFixed(2)}`);
            console.log(`   Поворот: ${angle.toFixed(2)}°`);
            console.log(`   Масштаб: ${scale.toFixed(3)}`);
            console.log(`   Доверие: ${Math.min(0.95, sourcePoints.length / 10).toFixed(3)}`);
           
            return {
                translation: { dx: avgDx, dy: avgDy },
                rotation: angle,
                scale: scale,
                confidence: Math.min(0.95, sourcePoints.length / 10),
                type: 'affine_from_matches',
                calculatedFromMatches: true,
                matchCount: sourcePoints.length
            };
           
        } catch (error) {
            console.log('❌ Ошибка вычисления трансформации:', error.message);
            return null;
        }
    }

    // 🔴 5. ОБЪЕДИНЕНИЕ ТОЧЕК С УЧЕТОМ ПОДТВЕРЖДЕНИЙ
    mergePointsWithConfidence(points1, transformedPoints2, matchThreshold = 15) {
        const confirmedPoints = [];
        const newPointsFrom1 = [];
        const newPointsFrom2 = [];
        const matches = [];
        const usedPoints2 = new Set();

        console.log(`🎯 Объединяю ${points1.length} и ${transformedPoints2.length} точек`);
        console.log(`   Порог совпадения: ${matchThreshold} пикселей`);

        // 🔍 Ищем совпадения
        points1.forEach((p1, i) => {
            let bestMatch = null;
            let bestDistance = Infinity;
            let bestIndex = -1;

            transformedPoints2.forEach((p2, j) => {
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
                // ✅ СОВПАДЕНИЕ
                const confirmedPoint = {
                    ...p1,
                    x: (p1.x + bestMatch.x) / 2, // Среднее положение
                    y: (p1.y + bestMatch.y) / 2,
                    confidence: Math.max(p1.confidence || 0.5, bestMatch.confidence || 0.5),
                    confirmationCount: (p1.confirmationCount || 1) + (bestMatch.confirmationCount || 1),
                    source: 'confirmed',
                    originalPoints: [p1, bestMatch],
                    matchDistance: bestDistance,
                    isAnchorPoint: true // Это опорная точка
                };

                confirmedPoints.push(confirmedPoint);
                matches.push({
                    point1: p1,
                    point2: bestMatch,
                    distance: bestDistance,
                    mergedPoint: confirmedPoint
                });

                usedPoints2.add(bestIndex);
               
                if (confirmedPoints.length <= 5) {
                    console.log(`   Совпадение ${confirmedPoints.length}: расстояние ${bestDistance.toFixed(2)}`);
                }
            } else {
                // 🔍 НОВАЯ ТОЧКА ИЗ СЛЕДА 1
                newPointsFrom1.push({
                    ...p1,
                    source: 'new_from_1',
                    confirmationCount: p1.confirmationCount || 1,
                    isAnchorPoint: false
                });
            }
        });

        // 🔍 НОВЫЕ ТОЧКИ ИЗ ТРАНСФОРМИРОВАННОГО СЛЕДА 2
        transformedPoints2.forEach((p2, j) => {
            if (!usedPoints2.has(j)) {
                newPointsFrom2.push({
                    ...p2,
                    source: 'new_from_2',
                    confirmationCount: p2.confirmationCount || 1,
                    isAnchorPoint: false
                });
            }
        });

        console.log(`📊 Результат: ${confirmedPoints.length} совпадений, ${newPointsFrom1.length}+${newPointsFrom2.length} новых`);

        return {
            confirmedPoints,
            newPointsFrom1,
            newPointsFrom2,
            matches,
            allPoints: [...confirmedPoints, ...newPointsFrom1, ...newPointsFrom2],
            totalConfirmed: confirmedPoints.length,
            totalNew: newPointsFrom1.length + newPointsFrom2.length
        };
    }

    // 🔴 6. ИЗВЛЕЧЬ ТОЧКИ С ДАННЫМИ О ПОДТВЕРЖДЕНИИ
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
                    confirmationCount: 1,
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

    // 🔴 7. ОТРИСОВКА ОБЪЕДИНЕННОГО СЛЕДА
    drawMergedFootprint(ctx, mergedResult, scale, offsetX, offsetY, showConfidence = true) {
        // 🔴 1. ПОДТВЕРЖДЕННЫЕ ТОЧКИ (ядро - ЗЕЛЕНЫЙ) - ЭТО НАШИ ОПОРНЫЕ ТОЧКИ
        mergedResult.confirmedPoints.forEach(point => {
            const x = offsetX + point.x * scale;
            const y = offsetY + point.y * scale;
           
            const size = 8 + Math.min(point.confirmationCount, 5); // Крупнее для опорных точек
            const color = 'rgba(0, 200, 83, 0.9)'; // Ярко-зеленый для опорных
           
            // Большой внешний круг
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
           
            // Белое ядро
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
            ctx.fill();
           
            // Подпись с номером опорной точки
            if (showConfidence) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('★', x, y + 4); // Звездочка для опорных точек
                ctx.textAlign = 'left';
            }
        });

        // 🔴 2. НОВЫЕ ТОЧКИ ИЗ СЛЕДА 1 (СИНИЙ)
        mergedResult.newPointsFrom1.forEach(point => {
            const x = offsetX + point.x * scale;
            const y = offsetY + point.y * scale;
           
            ctx.fillStyle = 'rgba(50, 100, 255, 0.6)';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
           
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        });

        // 🔴 3. НОВЫЕ ТОЧКИ ИЗ СЛЕДА 2 (КРАСНЫЙ) - УЖЕ ТРАНСФОРМИРОВАННЫЕ
        mergedResult.newPointsFrom2.forEach(point => {
            const x = offsetX + point.x * scale;
            const y = offsetY + point.y * scale;
           
            ctx.fillStyle = 'rgba(255, 50, 50, 0.6)';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
           
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // 🔴 8. ЛИНИИ МЕЖДУ СОВПАВШИМИ ТОЧКАМИ (ОПОРНЫЕ СОЕДИНЕНИЯ)
    drawMatchLines(ctx, matches, scale, offsetX, offsetY) {
        ctx.strokeStyle = 'rgba(0, 200, 83, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);

        matches.forEach((match, index) => {
            const p1 = match.point1;
            const p2 = match.point2;
           
            const x1 = offsetX + p1.x * scale;
            const y1 = offsetY + p1.y * scale;
            const x2 = offsetX + p2.x * scale;
            const y2 = offsetY + p2.y * scale;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Номер соответствия в середине линии
            ctx.fillStyle = 'rgba(0, 200, 83, 0.9)';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${index + 1}`, (x1 + x2) / 2, (y1 + y2) / 2 - 3);
            ctx.textAlign = 'left';
        });

        ctx.setLineDash([]);
    }

    // 🔴 9. ДЕТАЛЬНАЯ ЛЕГЕНДА
    drawDetailedLegend(ctx, mergedResult, matchCount, x, y) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('📋 ЛЕГЕНДА НАЛОЖЕНИЯ', x, y);

        y += 35;
        ctx.font = '14px Arial';

        const legendItems = [
            { color: 'rgba(0, 200, 83, 0.9)', text: `★ Опорные точки (совпали) - ${mergedResult.confirmedPoints.length}` },
            { color: 'rgba(50, 100, 255, 0.6)', text: `🔵 Новые из следа 1 - ${mergedResult.newPointsFrom1.length}` },
            { color: 'rgba(255, 50, 50, 0.6)', text: `🔴 Новые из следа 2 - ${mergedResult.newPointsFrom2.length}` },
            { color: 'rgba(0, 200, 83, 0.6)', text: `📐 Опорные связи (${matchCount})` },
            { text: 'Цифры на линиях - номер пары соответствия' }
        ];

        legendItems.forEach((item, index) => {
            if (item.color) {
                ctx.fillStyle = item.color;
                ctx.beginPath();
                if (item.text.includes('★')) {
                    // Для звездочки рисуем звезду
                    ctx.font = 'bold 16px Arial';
                    ctx.fillText('★', x + 5, y + 8);
                } else {
                    ctx.arc(x + 10, y + 5, 6, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
           
            ctx.fillStyle = '#cccccc';
            ctx.font = '14px Arial';
            ctx.fillText(item.text, x + 25, y + 10);
            y += 25;
        });
    }

    // 🔴 10. СТАТИСТИКА ОБЪЕДИНЕНИЯ
    calculateMergeStats(mergedResult, comparisonResult, transformationResult, matchCount) {
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
            vectorMatches: matchCount,
            transformation: transformationResult ? 'Применена' : 'Нет',
            transformationConfidence: transformationResult?.confidence?.toFixed(3) || 'N/A',
            transformationType: transformationResult?.type || 'N/A',
            similarity: comparisonResult?.similarity?.toFixed(3) || 'N/A',
            quality: this.calculateMergeQuality(mergedResult, matchCount)
        };
    }

    drawStatistics(ctx, stats, x, y) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('📊 СТАТИСТИКА НАЛОЖЕНИЯ', x, y);

        y += 35;
        ctx.font = '14px Arial';
        ctx.fillStyle = '#cccccc';

        const statItems = [
            `📈 Всего точек: ${stats.totalPoints}`,
            `★ Опорных точек: ${stats.confirmedPoints} (${stats.confirmedPercent}%)`,
            `🔍 Новых деталей: ${stats.newPoints}`,
            `📐 Векторных соответствий: ${stats.vectorMatches}`,
            `🔄 Трансформация: ${stats.transformation}`,
            `🎯 Тип трансформации: ${stats.transformationType}`,
            `💎 Качество наложения: ${stats.quality}/100`
        ];

        statItems.forEach((item, index) => {
            ctx.fillText(item, x, y + index * 25);
        });
    }

    // 🔴 11. КАЧЕСТВО ОБЪЕДИНЕНИЯ
    calculateMergeQuality(mergedResult, matchCount) {
        if (mergedResult.allPoints.length === 0) return 0;
       
        const confirmedRatio = mergedResult.confirmedPoints.length / mergedResult.allPoints.length;
        const matchRatio = matchCount / Math.max(mergedResult.allPoints.length, 1);
       
        // Качество от 0 до 100
        let quality = (confirmedRatio * 50) + (matchRatio * 50);
       
        // Бонус за множество подтверждений
        if (mergedResult.confirmedPoints.length > 5) quality += 10;
        if (mergedResult.confirmedPoints.length > 10) quality += 10;
       
        return Math.min(Math.round(quality), 100);
    }

    drawMergeQuality(ctx, mergedResult, x, y) {
        const quality = this.calculateMergeQuality(mergedResult, mergedResult.matches.length);
       
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('🏆 КАЧЕСТВО НАЛОЖЕНИЯ', x, y);
       
        y += 30;
       
        const barWidth = 300;
        const barHeight = 20;
        const filledWidth = (barWidth * quality) / 100;
       
        // Фон
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x, y, barWidth, barHeight);
       
        // Заполнение
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

    // 🔴 12. ИНФОРМАЦИЯ О ТРАНСФОРМАЦИИ
    drawTransformationInfo(ctx, transformation, matchCount, x, y) {
        ctx.fillStyle = 'rgba(0, 200, 83, 0.9)';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('🔄 ТРАНСФОРМАЦИЯ', x, y);

        y += 25;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '14px Arial';

        if (transformation.translation) {
            ctx.fillText(`↔ Смещение: dx=${transformation.translation.dx?.toFixed(2) || 0}, dy=${transformation.translation.dy?.toFixed(2) || 0}`, x, y);
            y += 20;
        }
       
        if (transformation.rotation && Math.abs(transformation.rotation) > 0.1) {
            ctx.fillText(`↻ Поворот: ${transformation.rotation?.toFixed(2)}°`, x, y);
            y += 20;
        }
       
        if (transformation.scale && Math.abs(transformation.scale - 1) > 0.01) {
            ctx.fillText(`⚖ Масштаб: ${transformation.scale?.toFixed(3)}`, x, y);
            y += 20;
        }
       
        ctx.fillText(`📐 Рассчитано из: ${matchCount} пар точек`, x, y);
        y += 20;
        ctx.fillText(`🎯 Уверенность: ${transformation.confidence?.toFixed(3) || 0}`, x, y);
    }

    // 🔴 13. СОЗДАТЬ ОПИСАНИЕ ДЛЯ TELEGRAM
    createMergeCaption(footprint1, footprint2, stats) {
        return `<b>🎯 НАЛОЖЕНИЕ СЛЕДОВ ПО ОПОРНЫМ ТОЧКАМ</b>\n\n` +
               `<b>📸 ${footprint1.name}:</b> + ${footprint2.name}\n` +
               `<b>★ Опорных точек:</b> ${stats.confirmedPoints} (${stats.confirmedPercent}%)\n` +
               `<b>📐 Векторных соответствий:</b> ${stats.vectorMatches}\n` +
               `<b>🔍 Новых деталей:</b> ${stats.newPoints}\n` +
               `<b>🔄 Трансформация:</b> ${stats.transformation} (${stats.transformationType})\n` +
               `<b>🏆 Качество наложения:</b> ${stats.quality}/100\n\n` +
               `<i>★ Опорные точки | 🔵 Новые из 1 | 🔴 Новые из 2</i>`;
    }

    // 🔴 14. ВЕКТОРНОЕ СРАВНЕНИЕ ДЛЯ ТРАНСФОРМАЦИИ
    compareWithVectorGraphs(points1, points2) {
        if (points1.length < 4 || points2.length < 4) {
            console.log('⚠️ Недостаточно точек для векторного сравнения');
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
                    score: match.score || 0,
                    vectorIndex: match
                };
            }).filter(match => match !== null);

            console.log(`🔗 Векторное сравнение: ${pointMatches.length} соответствий, схожесть ${vectorComparison.similarity?.toFixed(3) || 0}`);
           
            if (vectorComparison.transformation) {
                console.log(`🔄 Исходная трансформация от VectorGraph:`);
                console.log(`   Смещение: dx=${vectorComparison.transformation.translation?.dx?.toFixed(2) || 0}, dy=${vectorComparison.transformation.translation?.dy?.toFixed(2) || 0}`);
                console.log(`   Поворот: ${vectorComparison.transformation.rotation?.toFixed(2) || 0}°`);
                console.log(`   Масштаб: ${vectorComparison.transformation.scale?.toFixed(3) || 1}`);
            }

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

    // 🔴 15. ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ
    applyTransformation(points, transformation) {
        if (!transformation || transformation.type === 'insufficient_points') {
            console.log('⚠️ Трансформация не применена');
            return points;
        }

        console.log(`🔄 Применяю трансформацию к ${points.length} точкам:`);
        console.log(`   Смещение: dx=${transformation.translation?.dx?.toFixed(2) || 0}, dy=${transformation.translation?.dy?.toFixed(2) || 0}`);
        console.log(`   Поворот: ${transformation.rotation?.toFixed(2) || 0}°`);
        console.log(`   Масштаб: ${transformation.scale?.toFixed(3) || 1}`);

        const transformed = points.map((p, index) => {
            let x = p.x;
            let y = p.y;

            // Применяем смещение
            x += transformation.translation?.dx || 0;
            y += transformation.translation?.dy || 0;

            // Применяем поворот (если есть)
            if (transformation.rotation && Math.abs(transformation.rotation) > 0.1) {
                const rad = transformation.rotation * Math.PI / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const newX = x * cos - y * sin;
                const newY = x * sin + y * cos;
                x = newX;
                y = newY;
            }

            // Применяем масштаб (если есть)
            if (transformation.scale && Math.abs(transformation.scale - 1) > 0.01) {
                x *= transformation.scale;
                y *= transformation.scale;
            }

            return { ...p, x, y };
        });

        // Логируем первые 2 точки для проверки
        if (points.length > 1 && transformed.length > 1) {
            console.log(`📐 Примеры трансформации:`);
            console.log(`   Точка 1: (${points[0].x.toFixed(2)}, ${points[0].y.toFixed(2)}) → ` +
                       `(${transformed[0].x.toFixed(2)}, ${transformed[0].y.toFixed(2)})`);
            console.log(`   Точка 2: (${points[1].x.toFixed(2)}, ${points[1].y.toFixed(2)}) → ` +
                       `(${transformed[1].x.toFixed(2)}, ${transformed[1].y.toFixed(2)})`);
        }

        console.log(`✅ Трансформация применена ко всем точкам`);
        return transformed;
    }

    // 🔴 16. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ОТРИСОВКИ

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

        console.log(`📐 Нормализация: масштаб ${scale.toFixed(4)}, смещение (${offsetX.toFixed(0)}, ${offsetY.toFixed(0)})`);
        console.log(`   Диапазон X: ${minX.toFixed(0)} - ${maxX.toFixed(0)} (${rangeX.toFixed(0)})`);
        console.log(`   Диапазон Y: ${minY.toFixed(0)} - ${maxY.toFixed(0)} (${rangeY.toFixed(0)})`);

        return { scale, offsetX, offsetY };
    }
}

module.exports = MergeVisualizer;
