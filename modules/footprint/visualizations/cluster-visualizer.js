// modules/footprint/visualizations/cluster-visualizer.js
const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/clusters',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,
            pointColors: {
                confirmed2: '#FF5252',  // 🔴 Красный: 2 подтверждения
                confirmed1: '#2196F3',  // 🔵 Синий: 1 подтверждение
                confirmed0: '#BDBDBD',  // ⚪ Серый: 0 подтверждений
                highConfidence: '#FF9800', // Оранжевый: высокая уверенность
                mediumConfidence: '#4CAF50' // Зеленый: средняя уверенность
            },
            clusterColors: {
                strong: '#4CAF50',      // 🟢 Зеленый: надежный кластер (5+ точек)
                medium: '#FFC107',      // 🟡 Желтый: средний кластер (3-4 точки)
                weak: '#F44336',        // 🔴 Красный: слабый кластер (1-2 точки)
                outlineWidths: {
                    strong: 3,
                    medium: 2,
                    weak: 1
                }
            },
            connectionColors: {
                bothConfirmed: '#2196F3',     // Сплошная: оба конца подтверждены
                oneConfirmed: '#FF9800',      // Пунктир: один конец не подтвержден
                predicted: '#9E9E9D'          // Серая: предсказанная связь
            },
            legendPosition: options.legendPosition || 'bottom',
            ...options
        };

        // Создаем директорию
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
    }

    // 🔥 УПРОЩЕННАЯ ВИЗУАЛИЗАЦИЯ ДЛЯ ОТЛАДКИ
    createSimpleTextComparison(footprint1, footprint2, comparisonResult) {
        console.log('📝 Создаю текстовое сравнение для отладки...');

        const honestData1 = footprint1.getHonestVisualizationData ?
            footprint1.getHonestVisualizationData() : { confirmationsInfo: { totalPoints: 0, confirmed2: 0, confirmed1: 0, confirmed0: 0 } };

        const honestData2 = footprint2.getHonestVisualizationData ?
            footprint2.getHonestVisualizationData() : { confirmationsInfo: { totalPoints: 0, confirmed2: 0, confirmed1: 0, confirmed0: 0 } };

        const text = `
🎯 СРАВНЕНИЕ ДВУХ СЛЕДОВ
══════════════════════════════

📊 СВЕДЕНИЯ О СЛЕДАХ:
След 1: ${footprint1.name} (ID: ${footprint1.id.slice(0, 8)}...)
• Всего точек: ${honestData1.confirmationsInfo.totalPoints}
• 2+ подтверждений: ${honestData1.confirmationsInfo.confirmed2} 🔴
• 1 подтверждение: ${honestData1.confirmationsInfo.confirmed1} 🔵
• 0 подтверждений: ${honestData1.confirmationsInfo.confirmed0} ⚪

След 2: ${footprint2.name} (ID: ${footprint2.id.slice(0, 8)}...)
• Всего точек: ${honestData2.confirmationsInfo.totalPoints}
• 2+ подтверждений: ${honestData2.confirmationsInfo.confirmed2} 🔴
• 1 подтверждение: ${honestData2.confirmationsInfo.confirmed1} 🔵
• 0 подтверждений: ${honestData2.confirmationsInfo.confirmed0} ⚪

📈 СРАВНЕНИЕ:
• Схожесть: ${comparisonResult.similarity ? (comparisonResult.similarity * 100).toFixed(1) : 0}%
• Решение: ${comparisonResult.decision || 'unknown'}
• Метод: ${comparisonResult.method || 'unknown'}

🎨 ВИЗУАЛИЗАЦИЯ КЛАСТЕРОВ:
• 🔴 Красная точка: есть в ОБОИХ фото (2 подтверждения)
• 🔵 Синяя точка: есть в ОДНОМ фото (1 подтверждение)
• ⚪ Белая/серая: ожидается (0 подтверждений)
• Размер точки: уверенность детекции (0.5-1.0)

💡 ДЛЯ ГРАФИЧЕСКОЙ ВИЗУАЛИЗАЦИИ:
Установите canvas: npm install canvas

══════════════════════════════
Отчет создан: ${new Date().toLocaleString('ru-RU')}
    `;

        return text;
    }

    // 🔥 ОСНОВНОЙ МЕТОД: Визуализация сравнения двух следов
    async visualizeTwoFootprintComparison(footprint1, footprint2, options = {}) {
        console.log('🎨 Визуализация сравнения двух следов...');

        try {
            // Получаем точки из обоих следов
            const points1 = this.extractPointsWithConfirmations(footprint1);
            const points2 = this.extractPointsWithConfirmations(footprint2);

            // Анализируем совпадения
            const comparison = this.analyzePointMatches(points1, points2);

            // Определяем режим визуализации
            const visualizationMode = this.determineVisualizationMode(
                footprint1,
                footprint2,
                options
            );

            // Создаем визуализацию
            return await this.createComparisonVisualization(
                comparison,
                visualizationMode,
                options
            );

        } catch (error) {
            console.error('❌ Ошибка визуализации:', error);
            return this.createFallbackVisualization(footprint1, footprint2);
        }
    }

    // 🔥 ИЗВЛЕЧЕНИЕ ТОЧЕК С ПОДТВЕРЖДЕНИЯМИ
    extractPointsWithConfirmations(footprint) {
        const points = [];

        if (footprint.pointTracker && footprint.pointTracker.points) {
            // Используем данные из PointTracker
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({
                    id,
                    x: point.x,
                    y: point.y,
                    confirmedCount: point.confirmedCount || 0,
                    confidence: point.rating || point.confidence || 0.5,
                    source: 'tracker',
                    clusterData: point.clusterData,
                    lastSeen: point.lastSeen
                });
            }
        } else if (footprint.graph && footprint.graph.nodes) {
            // Используем данные из графа
            footprint.graph.nodes.forEach((node, nodeId) => {
                points.push({
                    id: nodeId,
                    x: node.x,
                    y: node.y,
                    confirmedCount: node.confirmedCount || 1, // Минимум 1
                    confidence: node.confidence || 0.5,
                    source: 'graph',
                    lastSeen: new Date()
                });
            });
        }

        return points;
    }

    // 🔥 АНАЛИЗ СОВПАДЕНИЙ ТОЧЕК
    analyzePointMatches(points1, points2) {
        const matches = [];
        const unmatched1 = [...points1];
        const unmatched2 = [...points2];

        // Ищем совпадения по координатам
        points1.forEach(point1 => {
            let bestMatch = null;
            let minDistance = 25; // Максимальное расстояние для совпадения

            points2.forEach((point2, index2) => {
                const dx = point1.x - point2.x;
                const dy = point1.y - point2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = { point: point2, index: index2, distance };
                }
            });

            if (bestMatch) {
                matches.push({
                    point1,
                    point2: bestMatch.point,
                    distance: bestMatch.distance,
                    type: 'match',
                    confidence: Math.min(point1.confidence, bestMatch.point.confidence)
                });

                // Удаляем из неподходящих
                const idx1 = unmatched1.findIndex(p => p.id === point1.id);
                if (idx1 !== -1) unmatched1.splice(idx1, 1);

                const idx2 = unmatched2.findIndex(p => p.id === bestMatch.point.id);
                if (idx2 !== -1) unmatched2.splice(idx2, 1);
            }
        });

        return {
            matches,
            uniqueToFirst: unmatched1,
            uniqueToSecond: unmatched2,
            stats: {
                totalMatches: matches.length,
                uniqueFirst: unmatched1.length,
                uniqueSecond: unmatched2.length,
                similarity: matches.length / Math.max(points1.length, points2.length)
            }
        };
    }

    // 🔥 ОПРЕДЕЛЕНИЕ РЕЖИМА ВИЗУАЛИЗАЦИИ
    determineVisualizationMode(footprint1, footprint2, options) {
        const photoCount1 = footprint1.photoHistory?.length || 0;
        const photoCount2 = footprint2.photoHistory?.length || 0;

        // Если явно указан режим
        if (options.mode) {
            return options.mode;
        }

        // Автоматическое определение
        const totalPhotos = photoCount1 + photoCount2;

        if (totalPhotos <= 2) {
            return 'simple';      // Простая схема для 1-2 фото
        } else if (totalPhotos <= 5) {
            return 'detailed';    // Детальная схема для 3-5 фото
        } else {
            return 'advanced';    // Продвинутая схема для 5+ фото
        }
    }

    // 🔥 СОЗДАНИЕ ВИЗУАЛИЗАЦИИ СРАВНЕНИЯ
    async createComparisonVisualization(comparison, mode, options) {
        // Проверяем доступность canvas
        let canvas;
        try {
            canvas = require('canvas');
        } catch (error) {
            console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
            return this.createTextComparisonReport(comparison, mode, options);
        }

        // Создаем canvas
        const canvasWidth = options.width || this.config.canvasWidth;
        const canvasHeight = options.height || this.config.canvasHeight;

        const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
        const ctx = canvasInstance.getContext('2d');

        // 1. ФОН
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 2. РАЗДЕЛИТЕЛЬНАЯ ЛИНИЯ
        ctx.strokeStyle = '#E0E0E0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(canvasWidth / 2, 100);
        ctx.lineTo(canvasWidth / 2, canvasHeight - 150);
        ctx.stroke();

        // 3. РИСУЕМ ТОЧКИ СЛЕДА 1 (слева)
        this.drawFootprintPoints(
            ctx,
            [...comparison.matches.map(m => m.point1), ...comparison.uniqueToFirst],
            'left',
            canvasWidth,
            canvasHeight,
            mode
        );

        // 4. РИСУЕМ ТОЧКИ СЛЕДА 2 (справа)
        this.drawFootprintPoints(
            ctx,
            [...comparison.matches.map(m => m.point2), ...comparison.uniqueToSecond],
            'right',
            canvasWidth,
            canvasHeight,
            mode
        );

        // 5. РИСУЕМ СВЯЗИ МЕЖДУ СОВПАДАЮЩИМИ ТОЧКАМИ
        this.drawMatchingConnections(ctx, comparison.matches, canvasWidth, canvasHeight);

        // 6. ДОБАВЛЯЕМ ИНФОРМАЦИЮ И ЛЕГЕНДУ
        this.drawComparisonInfo(ctx, comparison, canvasWidth, canvasHeight, mode);

        // 7. СОХРАНЯЕМ ИЗОБРАЖЕНИЕ
        const filename = options.filename || `comparison_${Date.now()}.png`;
        const outputPath = path.join(this.config.outputDir, filename);

        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(outputPath);
            const stream = canvasInstance.createPNGStream();

            stream.pipe(out);

            out.on('finish', () => {
                console.log(`✅ Визуализация сравнения сохранена: ${outputPath}`);
                resolve({
                    path: outputPath,
                    stats: comparison.stats,
                    mode: mode
                });
            });

            out.on('error', reject);
        });
    }

    // 🔥 ОТРИСОВКА ТОЧКИ СЛЕДА
    drawFootprintPoints(ctx, points, side, canvasWidth, canvasHeight, mode) {
        const isLeft = side === 'left';
        const offsetX = isLeft ? canvasWidth * 0.25 : canvasWidth * 0.75;
        const offsetY = canvasHeight * 0.5;

        // Масштабируем точки
        const { minX, maxX, minY, maxY } = this.calculatePointBounds(points);
        const scale = this.calculateScale(minX, maxX, minY, maxY, canvasWidth * 0.4, canvasHeight * 0.6);

        points.forEach(point => {
            const x = offsetX + (point.x - (minX + maxX) / 2) * scale;
            const y = offsetY + (point.y - (minY + maxY) / 2) * scale;

            // Цвет точки в зависимости от подтверждений
            let color;
            if (point.confirmedCount >= 2) {
                color = this.config.pointColors.confirmed2;
            } else if (point.confirmedCount >= 1) {
                color = this.config.pointColors.confirmed1;
            } else {
                color = this.config.pointColors.confirmed0;
            }

            // Размер точки в зависимости от уверенности
            const size = 5 + (point.confidence * 10);

            // Рисуем точку
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            // Обводка для высоконадежных точек
            if (point.confidence > 0.8) {
                ctx.strokeStyle = this.config.pointColors.highConfidence;
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Подписи для точек с кластерами
            if (point.clusterData && point.clusterData.size > 3) {
                ctx.fillStyle = '#000000';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`C${point.clusterData.size}`, x, y);
            }
        });
    }

    // 🔥 ОТРИСОВКА СВЯЗЕЙ МЕЖДУ ТОЧКАМИ
    drawMatchingConnections(ctx, matches, canvasWidth, canvasHeight) {
        const leftCenterX = canvasWidth * 0.25;
        const rightCenterX = canvasWidth * 0.75;
        const centerY = canvasHeight * 0.5;

        matches.forEach(match => {
            // Координаты точки слева
            const x1 = leftCenterX;
            const y1 = centerY;

            // Координаты точки справа
            const x2 = rightCenterX;
            const y2 = centerY;

            // Стиль линии в зависимости от качества совпадения
            let lineStyle;
            if (match.distance < 10) {
                lineStyle = {
                    color: '#4CAF50', // Зеленая для хороших совпадений
                    width: 2,
                    dash: []
                };
            } else if (match.distance < 20) {
                lineStyle = {
                    color: '#FFC107', // Желтая для средних совпадений
                    width: 1.5,
                    dash: [5, 5]
                };
            } else {
                lineStyle = {
                    color: '#F44336', // Красная для слабых совпадений
                    width: 1,
                    dash: [3, 3]
                };
            }

            // Рисуем линию
            ctx.strokeStyle = lineStyle.color;
            ctx.lineWidth = lineStyle.width;
            ctx.setLineDash(lineStyle.dash);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            ctx.setLineDash([]);
        });
    }

    // 🔥 ОТРИСОВКА ИНФОРМАЦИИ И ЛЕГЕНДЫ
    drawComparisonInfo(ctx, comparison, canvasWidth, canvasHeight, mode) {
        // Заголовок
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👣 СРАВНЕНИЕ ДВУХ СЛЕДОВ', canvasWidth / 2, 50);

        // Статистика
        ctx.font = '16px Arial';
        ctx.fillStyle = '#495057';

        const statsText = [
            `🔍 Общих точек: ${comparison.stats.totalMatches}`,
            `📊 Схожесть: ${(comparison.stats.similarity * 100).toFixed(1)}%`,
            `📍 Уникальных в первом: ${comparison.stats.uniqueFirst}`,
            `📍 Уникальных во втором: ${comparison.stats.uniqueSecond}`
        ];

        statsText.forEach((text, index) => {
            ctx.fillText(text, canvasWidth / 2, 90 + index * 25);
        });

        // Легенда (снизу)
        this.drawLegend(ctx, canvasWidth, canvasHeight, mode);
    }

    // 🔥 ОТРИСОВКА ЛЕГЕНДЫ
    drawLegend(ctx, canvasWidth, canvasHeight, mode) {
        const legendY = canvasHeight - 120;
        const legendItems = this.getLegendItems(mode);

        ctx.fillStyle = '#F8F9FA';
        ctx.fillRect(50, legendY - 20, canvasWidth - 100, 100);

        ctx.strokeStyle = '#DEE2E6';
        ctx.lineWidth = 1;
        ctx.strokeRect(50, legendY - 20, canvasWidth - 100, 100);

        // Заголовок легенды
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📋 ЛЕГЕНДА', 70, legendY);

        // Элементы легенды
        const columnWidth = (canvasWidth - 140) / 3;
        legendItems.forEach((column, colIndex) => {
            const startX = 70 + colIndex * columnWidth;

            column.forEach((item, itemIndex) => {
                const y = legendY + 20 + itemIndex * 25;

                // Рисуем образец
                if (item.type === 'point') {
                    ctx.fillStyle = item.color;
                    ctx.beginPath();
                    ctx.arc(startX + 10, y + 5, 8, 0, Math.PI * 2);
                    ctx.fill();
                } else if (item.type === 'line') {
                    ctx.strokeStyle = item.color;
                    ctx.lineWidth = item.width || 2;
                    ctx.setLineDash(item.dash || []);

                    ctx.beginPath();
                    ctx.moveTo(startX, y + 5);
                    ctx.lineTo(startX + 20, y + 5);
                    ctx.stroke();

                    ctx.setLineDash([]);
                }

                // Текст
                ctx.fillStyle = '#495057';
                ctx.font = '14px Arial';
                ctx.fillText(item.text, startX + 30, y + 10);
            });
        });
    }

    // 🔥 ПОЛУЧЕНИЕ ЭЛЕМЕНТОВ ЛЕГЕНДЫ
    getLegendItems(mode) {
        if (mode === 'simple') {
            return [
                [ // Колонка 1: Точки
                    { type: 'point', color: '#FF5252', text: '2 подтверждения' },
                    { type: 'point', color: '#2196F3', text: '1 подтверждение' },
                    { type: 'point', color: '#BDBDBD', text: '0 подтверждений' }
                ],
                [ // Колонка 2: Связи
                    { type: 'line', color: '#4CAF50', text: 'Хорошее совпадение' },
                    { type: 'line', color: '#FFC107', text: 'Среднее совпадение', dash: [5, 5] },
                    { type: 'line', color: '#F44336', text: 'Слабое совпадение', dash: [3, 3] }
                ],
                [ // Колонка 3: Качество
                    { type: 'point', color: '#FF9800', text: 'Высокая уверенность' },
                    { type: 'text', text: 'C5 = кластер 5 точек' },
                    { type: 'text', text: 'Размер = уверенность' }
                ]
            ];
        }

        // Режимы detailed и advanced будут расширять легенду
        return this.getLegendItems('simple');
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    calculatePointBounds(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        points.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });

        return { minX, maxX, minY, maxY };
    }

    calculateScale(minX, maxX, minY, maxY, targetWidth, targetHeight) {
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);

        const scaleX = targetWidth / width;
        const scaleY = targetHeight / height;

        return Math.min(scaleX, scaleY, 5); // Ограничиваем масштаб
    }

    // 🔥 ТЕКСТОВЫЙ ОТЧЕТ (фаллбэк)
    createTextComparisonReport(comparison, mode, options) {
        const filename = options.filename || `comparison_report_${Date.now()}.txt`;
        const outputPath = path.join(this.config.outputDir, filename);

        const report = `
СРАВНЕНИЕ ДВУХ СЛЕДОВ - ТЕКСТОВЫЙ ОТЧЕТ
════════════════════════════════════════

📊 СТАТИСТИКА СРАВНЕНИЯ:
• Общих точек: ${comparison.stats.totalMatches}
• Схожесть: ${(comparison.stats.similarity * 100).toFixed(1)}%
• Уникальных в первом следе: ${comparison.stats.uniqueFirst}
• Уникальных во втором следе: ${comparison.stats.uniqueSecond}

🎯 КАЧЕСТВО СОВПАДЕНИЙ:
${this.formatMatchQuality(comparison.matches)}

📋 ЛЕГЕНДА:
• 🔴 Красная точка: 2 подтверждения (есть на обоих фото)
• 🔵 Синяя точка: 1 подтверждение (есть на одном фото)
• ⚪ Серая точка: 0 подтверждений (предсказанная)
• 🟢 Зеленая линия: хорошее совпадение (<10px)
• 🟡 Желтая линия: среднее совпадение (10-20px)
• 🔴 Красная линия: слабое совпадение (>20px)

💡 РЕКОМЕНДАЦИИ:
${this.getRecommendations(comparison.stats)}

════════════════════════════════════════
Отчет создан: ${new Date().toLocaleString('ru-RU')}
Режим визуализации: ${mode}
`;

        fs.writeFileSync(outputPath, report, 'utf8');

        return {
            path: outputPath,
            stats: comparison.stats,
            mode: mode,
            note: 'Установите Canvas для графической визуализации'
        };
    }

    formatMatchQuality(matches) {
        if (matches.length === 0) return 'Нет совпадений';

        const qualityGroups = {
            excellent: 0, // < 5px
            good: 0,      // 5-10px
            fair: 0,      // 10-15px
            poor: 0       // > 15px
        };

        matches.forEach(match => {
            if (match.distance < 5) qualityGroups.excellent++;
            else if (match.distance < 10) qualityGroups.good++;
            else if (match.distance < 15) qualityGroups.fair++;
            else qualityGroups.poor++;
        });

        return [
            `Отличные (<5px): ${qualityGroups.excellent}`,
            `Хорошие (5-10px): ${qualityGroups.good}`,
            `Средние (10-15px): ${qualityGroups.fair}`,
            `Слабые (>15px): ${qualityGroups.poor}`
        ].join('\n');
    }

    getRecommendations(stats) {
        const recommendations = [];

        if (stats.similarity > 0.8) {
            recommendations.push('✅ Высокая схожесть - вероятно, тот же след');
        } else if (stats.similarity > 0.5) {
            recommendations.push('⚠️ Умеренная схожесть - возможно, тот же тип обуви');
        } else {
            recommendations.push('❌ Низкая схожесть - разные следы');
        }

        if (stats.uniqueFirst > stats.uniqueSecond * 2) {
            recommendations.push('📸 Первый след имеет больше деталей');
        } else if (stats.uniqueSecond > stats.uniqueFirst * 2) {
            recommendations.push('📸 Второй след имеет больше деталей');
        }

        return recommendations.join('\n');
    }

    // 🔥 ФАЛЛБЭК ВИЗУАЛИЗАЦИЯ
    createFallbackVisualization(footprint1, footprint2) {
        const outputPath = path.join(this.config.outputDir, `fallback_${Date.now()}.txt`);

        const content = `
БАЗОВАЯ ВИЗУАЛИЗАЦИЯ СРАВНЕНИЯ
══════════════════════════════

След 1: ${footprint1.name}
• Узлов: ${footprint1.graph?.nodes?.size || 0}
• Фото: ${footprint1.photoHistory?.length || 0}

След 2: ${footprint2.name}
• Узлов: ${footprint2.graph?.nodes?.size || 0}
• Фото: ${footprint2.photoHistory?.length || 0}

⚠️ Для графической визуализации установите:
npm install canvas

Или используйте веб-интерфейс для просмотра.
`;

        fs.writeFileSync(outputPath, content, 'utf8');

        return {
            path: outputPath,
            note: 'Требуется Canvas для графической визуализации'
        };
    }
}

module.exports = ClusterVisualizer;
