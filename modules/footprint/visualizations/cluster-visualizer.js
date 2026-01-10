// modules/footprint/visualizations/cluster-visualizer.js 
// 🔥 ПЕРЕПИСАННЫЙ ВИЗУАЛИЗАТОР - ТОЛЬКО ОТОБРАЖЕНИЕ ПОДТВЕРЖДЕНИЙ
// НИКАКИХ СРАВНЕНИЙ - ПРОСТО ВИЗУАЛИЗАЦИЯ ТОГО, ЧТО УЖЕ ЕСТЬ

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/clusters',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,
           
            // 🔥 ПРОСТАЯ ЦВЕТОВАЯ СХЕМА
            pointColors: {
                confirmed2: '#FF5252',  // 🔴 Красный: 2+ подтверждения
                confirmed1: '#2196F3',  // 🔵 Синий: 1 подтверждение
                confirmed0: '#BDBDBD',  // ⚪ Серый: 0 подтверждений
                highConfidence: '#FF9800', // Оранжевый: высокая уверенность
                background: '#FFFFFF'   // Белый фон
            },
           
            // 🔥 НЕТ КЛАСТЕРОВ, НЕТ СВЯЗЕЙ - ТОЛЬКО ТОЧКИ
            legendPosition: options.legendPosition || 'bottom',
            showStats: options.showStats !== false,
            debug: options.debug || false,
           
            ...options
        };

        // Создаем директорию
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
       
        console.log('🎨 Упрощенный ClusterVisualizer создан');
    }

    // 🔥 ОСНОВНОЙ МЕТОД: Простая визуализация подтверждений
    async visualizeConfirmations(footprint1, footprint2, options = {}) {
        console.log('🎨 Визуализация подтверждений (без сравнения)...');

        try {
            // 1. Получаем точки ИЗ POINT TRACKER
            const points1 = this.getPointsFromPointTracker(footprint1);
            const points2 = this.getPointsFromPointTracker(footprint2);

            // 2. Рассчитываем статистику
            const stats1 = this.calculateConfirmationStats(points1);
            const stats2 = this.calculateConfirmationStats(points2);

            console.log(`📊 Статистика подтверждений:`);
            console.log(`   След 1: ${stats1.total} точек, 🔴 ${stats1.confirmed2}, 🔵 ${stats1.confirmed1}`);
            console.log(`   След 2: ${stats2.total} точек, 🔴 ${stats2.confirmed2}, 🔵 ${stats2.confirmed1}`);

            // 3. Создаем визуализацию
            const result = await this.createConfirmationVisualization(
                points1, points2,
                footprint1, footprint2,
                stats1, stats2,
                options
            );

            return result;

        } catch (error) {
            console.error('❌ Ошибка визуализации:', error);
            return this.createFallbackReport(footprint1, footprint2);
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Получить точки напрямую из PointTracker
    getPointsFromPointTracker(footprint) {
        const points = [];

        if (!footprint || !footprint.pointTracker) {
            console.log('⚠️ Нет PointTracker в отпечатке');
            return points;
        }

        // 🔥 БЕРЕМ ТОЧКИ НАПРЯМУЮ ИЗ POINT TRACKER
        for (const [id, point] of footprint.pointTracker.points) {
            points.push({
                id,
                x: point.x,
                y: point.y,
                confirmedCount: point.confirmedCount || 1,
                confidence: point.rating || point.confidence || 0.5,
                source: 'point_tracker',
                lastSeen: point.lastSeen
            });
        }

        console.log(`📊 Получено ${points.length} точек из PointTracker`);

        // Если точек нет, пытаемся получить из графа (фоллбэк)
        if (points.length === 0 && footprint.graph && footprint.graph.nodes) {
            console.log('⚠️ Точки из PointTracker не найдены, пробую из графа...');
            footprint.graph.nodes.forEach((node, nodeId) => {
                points.push({
                    id: nodeId,
                    x: node.x,
                    y: node.y,
                    confirmedCount: node.confirmedCount || 1,
                    confidence: node.confidence || 0.5,
                    source: 'graph_fallback'
                });
            });
        }

        return points;
    }

    // 🔥 РАСЧЕТ СТАТИСТИКИ ПОДТВЕРЖДЕНИЙ
    calculateConfirmationStats(points) {
        let confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;
        let totalConfidence = 0;

        points.forEach(point => {
            const confirmations = point.confirmedCount || 0;
           
            if (confirmations >= 2) {
                confirmed2++;
            } else if (confirmations >= 1) {
                confirmed1++;
            } else {
                confirmed0++;
            }
           
            totalConfidence += point.confidence || 0.5;
        });

        return {
            total: points.length,
            confirmed2,
            confirmed1,
            confirmed0,
            avgConfidence: points.length > 0 ? totalConfidence / points.length : 0
        };
    }

    // 🔥 СОЗДАНИЕ ВИЗУАЛИЗАЦИИ ПОДТВЕРЖДЕНИЙ
    async createConfirmationVisualization(points1, points2, footprint1, footprint2, stats1, stats2, options = {}) {
        // Проверяем доступность canvas
        let canvas;
        try {
            canvas = require('canvas');
        } catch (error) {
            console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
            return this.createTextConfirmationReport(
                points1, points2, footprint1, footprint2, stats1, stats2, options
            );
        }

        // Создаем canvas
        const canvasWidth = options.width || this.config.canvasWidth;
        const canvasHeight = options.height || this.config.canvasHeight;

        const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
        const ctx = canvasInstance.getContext('2d');

        // 1. ФОН
        ctx.fillStyle = this.config.pointColors.background;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 2. ЗАГОЛОВОК
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👣 ПОДТВЕРЖДЕНИЯ ТОЧЕК', canvasWidth / 2, 50);

        // 3. ИНФОРМАЦИЯ О СЛЕДАХ
        ctx.font = '16px Arial';
        ctx.fillStyle = '#495057';
        ctx.textAlign = 'center';
       
        const name1 = footprint1.name || 'След 1';
        const name2 = footprint2.name || 'След 2';
       
        ctx.fillText(`${name1} vs ${name2}`, canvasWidth / 2, 85);
       
        // 4. СТАТИСТИКА
        ctx.font = '14px Arial';
        ctx.fillStyle = '#6C757D';
       
        const statsText = [
            `Всего точек: ${stats1.total} | ${stats2.total}`,
            `🔴 2+ подтверждений: ${stats1.confirmed2} | ${stats2.confirmed2}`,
            `🔵 1 подтверждение: ${stats1.confirmed1} | ${stats2.confirmed1}`,
            `⚪ 0 подтверждений: ${stats1.confirmed0} | ${stats2.confirmed0}`
        ];
       
        statsText.forEach((text, index) => {
            ctx.fillText(text, canvasWidth / 2, 115 + index * 20);
        });

        // 5. РАЗДЕЛИТЕЛЬНАЯ ЛИНИЯ
        ctx.strokeStyle = '#E0E0E0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(canvasWidth / 2, 200);
        ctx.lineTo(canvasWidth / 2, canvasHeight - 120);
        ctx.stroke();

        // 6. РИСУЕМ ТОЧКИ СЛЕДА 1 (слева)
        this.drawSimplePoints(ctx, points1, 'left', canvasWidth, canvasHeight, 'След 1');

        // 7. РИСУЕМ ТОЧКИ СЛЕДА 2 (справа)
        this.drawSimplePoints(ctx, points2, 'right', canvasWidth, canvasHeight, 'След 2');

        // 8. ЛЕГЕНДА
        this.drawSimpleLegend(ctx, canvasWidth, canvasHeight);

        // 9. ДАТА И ВРЕМЯ
        ctx.fillStyle = '#ADB5BD';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Визуализация создана: ${new Date().toLocaleString('ru-RU')}`, canvasWidth / 2, canvasHeight - 10);

        // 10. СОХРАНЯЕМ ИЗОБРАЖЕНИЕ
        const filename = options.filename || `confirmations_${Date.now()}.png`;
        const outputPath = path.join(this.config.outputDir, filename);

        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(outputPath);
            const stream = canvasInstance.createPNGStream();

            stream.pipe(out);

            out.on('finish', () => {
                console.log(`✅ Визуализация сохранена: ${outputPath}`);
                resolve({
                    path: outputPath,
                    stats: { stats1, stats2 },
                    mode: 'simple_confirmation',
                    success: true
                });
            });

            out.on('error', reject);
        });
    }

    // 🔥 ПРОСТОЕ РИСОВАНИЕ ТОЧЕК
    drawSimplePoints(ctx, points, side, canvasWidth, canvasHeight, label = '') {
        const isLeft = side === 'left';
        const offsetX = isLeft ? canvasWidth * 0.25 : canvasWidth * 0.75;
        const offsetY = canvasHeight * 0.55;
       
        // Подпись
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(label, offsetX, offsetY - 180);

        // Если нет точек - показываем сообщение
        if (points.length === 0) {
            ctx.fillStyle = '#6C757D';
            ctx.font = '14px Arial';
            ctx.fillText('Нет данных', offsetX, offsetY);
            return;
        }

        // Масштабирование точек
        const { minX, maxX, minY, maxY } = this.calculateBounds(points);
        const scale = this.calculateScale(minX, maxX, minY, maxY, canvasWidth * 0.4, canvasHeight * 0.5);

        // Рисуем каждую точку
        points.forEach(point => {
            const x = offsetX + (point.x - (minX + maxX) / 2) * scale;
            const y = offsetY + (point.y - (minY + maxY) / 2) * scale;

            // Цвет точки в зависимости от подтверждений
            let color;
            if (point.confirmedCount >= 2) {
                color = this.config.pointColors.confirmed2; // 🔴 Красный
            } else if (point.confirmedCount >= 1) {
                color = this.config.pointColors.confirmed1; // 🔵 Синий
            } else {
                color = this.config.pointColors.confirmed0; // ⚪ Серый
            }

            // Размер точки в зависимости от уверенности
            const size = 4 + (point.confidence * 8);

            // Рисуем точку
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            // Обводка для высоконадежных точек
            if (point.confidence > 0.8) {
                ctx.strokeStyle = this.config.pointColors.highConfidence;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        });
    }

    // 🔥 ПРОСТАЯ ЛЕГЕНДА
    drawSimpleLegend(ctx, canvasWidth, canvasHeight) {
        const legendY = canvasHeight - 100;
        const startX = canvasWidth * 0.1;
        const columnWidth = canvasWidth * 0.25;

        ctx.fillStyle = '#F8F9FA';
        ctx.fillRect(startX - 10, legendY - 20, canvasWidth * 0.8, 80);

        ctx.strokeStyle = '#DEE2E6';
        ctx.lineWidth = 1;
        ctx.strokeRect(startX - 10, legendY - 20, canvasWidth * 0.8, 80);

        // Заголовок легенды
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📋 ЛЕГЕНДА', startX, legendY);

        // Элементы легенды
        const legendItems = [
            { type: 'point', color: this.config.pointColors.confirmed2, text: '2+ подтверждений' },
            { type: 'point', color: this.config.pointColors.confirmed1, text: '1 подтверждение' },
            { type: 'point', color: this.config.pointColors.confirmed0, text: '0 подтверждений' },
            { type: 'point', color: this.config.pointColors.highConfidence, text: 'Высокая уверенность', outline: true }
        ];

        legendItems.forEach((item, index) => {
            const x = startX + (index % 2) * columnWidth;
            const y = legendY + 20 + Math.floor(index / 2) * 25;

            // Рисуем образец
            if (item.type === 'point') {
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.arc(x + 10, y + 5, 7, 0, Math.PI * 2);
                ctx.fill();

                if (item.outline) {
                    ctx.strokeStyle = '#212529';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }

            // Текст
            ctx.fillStyle = '#495057';
            ctx.font = '12px Arial';
            ctx.fillText(item.text, x + 25, y + 8);
        });
    }

    // 🔥 ТЕКСТОВЫЙ ОТЧЕТ (фаллбэк)
    createTextConfirmationReport(points1, points2, footprint1, footprint2, stats1, stats2, options = {}) {
        const filename = options.filename || `confirmations_report_${Date.now()}.txt`;
        const outputPath = path.join(this.config.outputDir, filename);

        const report = `
ПОДТВЕРЖДЕНИЯ ТОЧЕК - ТЕКСТОВЫЙ ОТЧЕТ
════════════════════════════════════

📊 СВЕДЕНИЯ О СЛЕДАХ:
След 1: ${footprint1.name || 'Неизвестный'} (ID: ${footprint1.id?.slice(0, 8) || 'N/A'})
• Всего точек: ${stats1.total}
• 🔴 2+ подтверждений: ${stats1.confirmed2}
• 🔵 1 подтверждение: ${stats1.confirmed1}
• ⚪ 0 подтверждений: ${stats1.confirmed0}
• Средняя уверенность: ${stats1.avgConfidence.toFixed(3)}

След 2: ${footprint2.name || 'Неизвестный'} (ID: ${footprint2.id?.slice(0, 8) || 'N/A'})
• Всего точек: ${stats2.total}
• 🔴 2+ подтверждений: ${stats2.confirmed2}
• 🔵 1 подтверждение: ${stats2.confirmed1}
• ⚪ 0 подтверждений: ${stats2.confirmed0}
• Средняя уверенность: ${stats2.avgConfidence.toFixed(3)}

🎯 ИНФОРМАЦИЯ О ПОДТВЕРЖДЕНИЯХ:
• 1 фото = 1 подтверждение точки
• 🔴 Красные точки: есть на 2+ фото
• 🔵 Синие точки: есть на 1 фото
• ⚪ Серые точки: предсказанные (0 фото)
• Размер точки: уверенность детекции

📈 АНАЛИЗ:
${this.analyzeConfirmationStats(stats1, stats2)}

💡 РЕКОМЕНДАЦИИ:
${this.getConfirmationRecommendations(stats1, stats2)}

════════════════════════════════════
Отчет создан: ${new Date().toLocaleString('ru-RU')}
Для графической визуализации установите: npm install canvas
`;

        fs.writeFileSync(outputPath, report, 'utf8');

        return {
            path: outputPath,
            stats: { stats1, stats2 },
            note: 'Текстовый отчет (установите Canvas для графики)'
        };
    }

    // 🔥 АНАЛИЗ СТАТИСТИКИ ПОДТВЕРЖДЕНИЙ
    analyzeConfirmationStats(stats1, stats2) {
        const analysis = [];
       
        // Анализ первого следа
        if (stats1.confirmed2 > 0) {
            const percent2 = (stats1.confirmed2 / stats1.total * 100).toFixed(1);
            analysis.push(`• След 1: ${percent2}% точек имеют 2+ подтверждений`);
        }
       
        if (stats2.confirmed2 > 0) {
            const percent2 = (stats2.confirmed2 / stats2.total * 100).toFixed(1);
            analysis.push(`• След 2: ${percent2}% точек имеют 2+ подтверждений`);
        }
       
        // Сравнение
        if (stats1.total > 0 && stats2.total > 0) {
            const diff = Math.abs(stats1.total - stats2.total);
            if (diff > 5) {
                analysis.push(`• Разница в количестве точек: ${diff}`);
            }
           
            const ratio2 = stats1.confirmed2 / Math.max(1, stats2.confirmed2);
            if (ratio2 > 1.5 || ratio2 < 0.67) {
                analysis.push(`• Существенная разница в подтвержденных точках`);
            }
        }
       
        return analysis.length > 0 ? analysis.join('\n') : 'Данные достаточно схожи';
    }

    // 🔥 РЕКОМЕНДАЦИИ
    getConfirmationRecommendations(stats1, stats2) {
        const recommendations = [];
       
        if (stats1.confirmed2 === 0 && stats1.total > 0) {
            recommendations.push('• След 1: Добавьте ещё фото для подтверждения точек');
        }
       
        if (stats2.confirmed2 === 0 && stats2.total > 0) {
            recommendations.push('• След 2: Добавьте ещё фото для подтверждения точек');
        }
       
        if (stats1.confirmed2 > 0 && stats2.confirmed2 > 0) {
            recommendations.push('• Оба следа имеют подтвержденные точки - хорошее качество');
        }
       
        if (stats1.avgConfidence > 0.7 || stats2.avgConfidence > 0.7) {
            recommendations.push('• Высокая уверенность детекции - хороший результат');
        }
       
        return recommendations.length > 0 ? recommendations.join('\n') : 'Продолжайте добавлять фото для улучшения качества';
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    calculateBounds(points) {
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

        return Math.min(scaleX, scaleY, 5);
    }

    // 🔥 ФАЛЛБЭК ОТЧЕТ
    createFallbackReport(footprint1, footprint2) {
        const outputPath = path.join(this.config.outputDir, `fallback_${Date.now()}.txt`);

        const content = `
ПРОСТОЙ ОТЧЕТ О ПОДТВЕРЖДЕНИЯХ
═══════════════════════════════

След 1: ${footprint1.name || 'Неизвестный'}
• ID: ${footprint1.id || 'N/A'}
• Узлов в графе: ${footprint1.graph?.nodes?.size || 0}
• PointTracker: ${footprint1.pointTracker?.points?.size || 0} точек

След 2: ${footprint2.name || 'Неизвестный'}
• ID: ${footprint2.id || 'N/A'}
• Узлов в графе: ${footprint2.graph?.nodes?.size || 0}
• PointTracker: ${footprint2.pointTracker?.points?.size || 0} точек

⚠️ Для графической визуализации установите Canvas:
npm install canvas

📋 ЛЕГЕНДА ПОДТВЕРЖДЕНИЙ:
• 🔴 Красная точка: 2+ подтверждений (точка на 2+ фото)
• 🔵 Синяя точка: 1 подтверждение (точка на 1 фото)
• ⚪ Серая точка: 0 подтверждений (предсказанная)

💡 СИСТЕМА ЧЕСТНЫХ ПОДТВЕРЖДЕНИЙ:
1 фото = 1 подтверждение точки
Предотвращает накрутку, гарантирует точный подсчет
`;

        fs.writeFileSync(outputPath, content, 'utf8');

        return {
            path: outputPath,
            note: 'Фаллбэк отчет (Canvas не установлен)'
        };
    }

    // 🔥 ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
    async visualizeTwoFootprintComparison(footprint1, footprint2, options = {}) {
        console.log('🎨 [Совместимость] Визуализация сравнения...');
        // Просто используем новый метод
        return await this.visualizeConfirmations(footprint1, footprint2, options);
    }

    // 🔥 ПРОСТОЕ ТЕКСТОВОЕ СРАВНЕНИЕ
    createSimpleTextComparison(footprint1, footprint2, comparisonResult) {
        console.log('📝 Создаю текстовое сравнение...');

        const points1 = this.getPointsFromPointTracker(footprint1);
        const points2 = this.getPointsFromPointTracker(footprint2);
       
        const stats1 = this.calculateConfirmationStats(points1);
        const stats2 = this.calculateConfirmationStats(points2);

        const text = `
🎯 СРАВНЕНИЕ ДВУХ СЛЕДОВ
══════════════════════════════

📊 СТАТИСТИКА ПОДТВЕРЖДЕНИЙ:
След 1: ${footprint1.name} (ID: ${footprint1.id?.slice(0, 8) || 'N/A'})
• Всего точек: ${stats1.total}
• 🔴 2+ подтверждений: ${stats1.confirmed2}
• 🔵 1 подтверждение: ${stats1.confirmed1}
• ⚪ 0 подтверждений: ${stats1.confirmed0}

След 2: ${footprint2.name} (ID: ${footprint2.id?.slice(0, 8) || 'N/A'})
• Всего точек: ${stats2.total}
• 🔴 2+ подтверждений: ${stats2.confirmed2}
• 🔵 1 подтверждение: ${stats2.confirmed1}
• ⚪ 0 подтверждений: ${stats2.confirmed0}

${comparisonResult ? `📈 СРАВНЕНИЕ ГРАФОВ:
• Схожесть: ${comparisonResult.similarity ? (comparisonResult.similarity * 100).toFixed(1) : 0}%
• Решение: ${comparisonResult.decision || 'unknown'}
• Метод: ${comparisonResult.method || 'unknown'}` : ''}

🎨 ВИЗУАЛИЗАЦИЯ:
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
}

module.exports = ClusterVisualizer;
