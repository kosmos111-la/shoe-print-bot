// modules/footprint/visualizations/cluster-visualizer.js
// 🔥 ДОБАВЛЕНЫ МЕТОДЫ ДЛЯ ВИЗУАЛИЗАЦИИ АККУМУЛЯТОРА

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/clusters',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,

            // 🔥 ЦВЕТА ДЛЯ АККУМУЛЯТОРА
            pointColors: {
                confirmed3: '#FF0000',   // 🔴 Красный: 3+ подтверждений
                confirmed2: '#FF6B00',   // 🟠 Оранжевый: 2 подтверждения
                confirmed1: '#2196F3',   // 🔵 Синий: 1 подтверждение
                background: '#FFFFFF',   // Белый фон
                grid: '#E9ECEF'          // Цвет сетки
            },

            legendPosition: options.legendPosition || 'bottom',
            showStats: options.showStats !== false,
            debug: options.debug || false,

            // 🔥 НАСТРОЙКИ ДЛЯ АККУМУЛЯТОРА
            accumulatorMode: true,
            showComparisonInfo: true,

            ...options
        };

        // Создаем директорию
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }

        console.log('🎨 ClusterVisualizer создан с визуализацией аккумулятора');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: ВИЗУАЛИЗАЦИЯ АККУМУЛЯТОРА
    async visualizeAccumulator(accumulatorData, options = {}) {
        console.log('🎨 Визуализация геометрического аккумулятора...');

        try {
            // Проверяем доступность canvas
            let canvas;
            try {
                canvas = require('canvas');
            } catch (error) {
                console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
                return this.createAccumulatorTextReport(accumulatorData, options);
            }

            // Создаем canvas
            const canvasWidth = options.width || 1000;
            const canvasHeight = options.height || 800;

            const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
            const ctx = canvasInstance.getContext('2d');

            // 1. ФОН С ГРАДИЕНТОМ И СЕТКОЙ
            this.drawBackgroundWithGrid(ctx, canvasWidth, canvasHeight);

            // 2. ЗАГОЛОВОК
            ctx.fillStyle = '#212529';
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`🎯 АККУМУЛЯТОР ГЕОМЕТРИЧЕСКИХ ТОЧЕК`, canvasWidth / 2, 45);

            // 3. ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ И АККУМУЛЯТОРЕ
            ctx.font = '18px Arial';
            ctx.fillStyle = '#495057';
            ctx.textAlign = 'center';
            ctx.fillText(`👤 Пользователь: ${accumulatorData.userId || 'unknown'} | 📊 Точки: ${accumulatorData.points?.length || 0}`,
                        canvasWidth / 2, 85);

            // 4. СТАТИСТИКА В ТАБЛИЦЕ
            const stats = accumulatorData.stats || {};
            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = '#343A40';
            ctx.textAlign = 'left';
            ctx.fillText('📊 СТАТИСТИКА АККУМУЛЯТОРА:', 50, 140);

            ctx.font = '18px Arial';
            ctx.fillStyle = '#495057';

            const statRows = [
                `Всего уникальных геометрических точек: ${stats.totalUniquePoints || 0}`,
                `🔴 3+ подтверждений (высокая надежность): ${stats.byConfirmations?.['3+'] || 0}`,
                `🟠 2 подтверждения (средняя надежность): ${stats.byConfirmations?.['2'] || 0}`,
                `🔵 1 подтверждение (новая точка): ${stats.byConfirmations?.['1'] || 0}`,
                `📈 Всего следов в аккумуляторе: ${accumulatorData.totalFootprints || 1}`,
                `📅 Создан: ${stats.createdAt ? new Date(stats.createdAt).toLocaleString('ru-RU') : 'недавно'}`
            ];

            statRows.forEach((text, index) => {
                ctx.fillText(text, 70, 180 + index * 32);
            });

            // 5. 🔥 РИСУЕМ ВСЕ ГЕОМЕТРИЧЕСКИЕ ТОЧКИ ИЗ АККУМУЛЯТОРА
            if (accumulatorData.points && accumulatorData.points.length > 0) {
                this.drawAccumulatorPoints(ctx, accumulatorData.points, canvasWidth, canvasHeight);
            } else {
                ctx.fillStyle = '#6C757D';
                ctx.font = '20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Нет геометрических точек для отображения', canvasWidth / 2, canvasHeight / 2);
            }

            // 6. ИНФОРМАЦИЯ О СРАВНЕНИИ (если есть)
            if (options.comparisonResult) {
                const similarity = options.comparisonResult.similarity || 0;
                const decision = options.comparisonResult.decision || 'unknown';

                ctx.fillStyle = similarity > 0.6 ? '#28A745' : '#DC3545';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(
                    `🎯 Геометрическое сходство: ${(similarity * 100).toFixed(1)}% (${decision})`,
                    canvasWidth / 2,
                    canvasHeight - 180
                );
            }

            // 7. 🔥 ЛЕГЕНДА ДЛЯ АККУМУЛЯТОРА
            this.drawAccumulatorLegend(ctx, canvasWidth, canvasHeight);

            // 8. ИНФОРМАЦИЯ О СИСТЕМЕ
            ctx.fillStyle = '#ADB5BD';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(
                `🎯 Геометрическая аккумуляция | Без трансформаций | ${new Date().toLocaleString('ru-RU')}`,
                canvasWidth / 2,
                canvasHeight - 20
            );

            // 9. СОХРАНЯЕМ
            const filename = options.filename || `accumulator_${accumulatorData.userId}_${Date.now()}.png`;
            const outputPath = path.join(this.config.outputDir, filename);

            return new Promise((resolve, reject) => {
                const out = fs.createWriteStream(outputPath);
                const stream = canvasInstance.createPNGStream();

                stream.pipe(out);

                out.on('finish', () => {
                    console.log(`✅ Визуализация аккумулятора сохранена: ${outputPath}`);
                    resolve({
                        path: outputPath,
                        stats: stats,
                        pointsCount: accumulatorData.points?.length || 0,
                        success: true,
                        type: 'accumulator'
                    });
                });

                out.on('error', reject);
            });

        } catch (error) {
            console.error('❌ Ошибка визуализации аккумулятора:', error);
            return this.createAccumulatorTextReport(accumulatorData, options);
        }
    }

    // 🔥 МЕТОД: РИСОВАНИЕ ФОНА С СЕТКОЙ
    drawBackgroundWithGrid(ctx, canvasWidth, canvasHeight) {
        // Градиентный фон
        const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
        gradient.addColorStop(0, '#F8F9FA');
        gradient.addColorStop(1, '#E9ECEF');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Сетка для наглядности
        ctx.strokeStyle = this.config.pointColors.grid;
        ctx.lineWidth = 0.5;

        // Вертикальные линии
        for (let x = 100; x < canvasWidth; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 150);
            ctx.lineTo(x, canvasHeight - 200);
            ctx.stroke();
        }

        // Горизонтальные линии
        for (let y = 150; y < canvasHeight - 200; y += 50) {
            ctx.beginPath();
            ctx.moveTo(100, y);
            ctx.lineTo(canvasWidth - 100, y);
            ctx.stroke();
        }

        // Точки сетки
        ctx.fillStyle = '#DEE2E6';
        for (let x = 100; x < canvasWidth - 100; x += 100) {
            for (let y = 150; y < canvasHeight - 200; y += 100) {
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // 🔥 МЕТОД: РИСОВАНИЕ ТОЧЕК ИЗ АККУМУЛЯТОРА
    drawAccumulatorPoints(ctx, points, canvasWidth, canvasHeight) {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight * 0.6;

        console.log(`🎨 Рисую ${points.length} геометрических точек из аккумулятора`);

        // Вычисляем границы для масштабирования
        const bounds = this.calculateAccumulatorBounds(points);
        const scale = this.calculateAccumulatorScale(bounds, canvasWidth * 0.7, canvasHeight * 0.4);

        // Рисуем каждую точку
        points.forEach(point => {
            const x = centerX + (point.x - bounds.centerX) * scale;
            const y = centerY + (point.y - bounds.centerY) * scale;

            // Используем цвет и размер из данных
            const color = point.color || this.getAccumulatorPointColor(point.confirmations || 1);
            const size = point.size || this.calculateAccumulatorPointSize(point.confirmations || 1, point.confidence || 0.5);

            // 1. Внешний круг (геометрическая точка)
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            // 2. Белая обводка для лучшей видимости
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 3. Внутренний круг для точек с 2+ подтверждениями
            if (point.confirmations >= 2) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // 4. 🔥 ПОДПИСЬ КОЛИЧЕСТВА ПОДТВЕРЖДЕНИЙ
            if (point.confirmations >= 2) {
                ctx.fillStyle = color;
                ctx.font = point.confirmations >= 3 ? 'bold 12px Arial' : 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(point.confirmations.toString(), x, y);
            }

            // 5. 🔥 КРУЖОК ДЛЯ НОВЫХ ТОЧЕК (1 подтверждение)
            if (point.confirmations === 1) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
                ctx.fill();

                // Буква N для новых точек
                ctx.fillStyle = color;
                ctx.font = 'bold 9px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('N', x, y);
            }

            // 6. 🔥 ПОДПИСЬ ГЕОМЕТРИЧЕСКОГО ХЕША (для точек с 3+ подтверждений)
            if (point.confirmations >= 3 && point.geometricHash) {
                const shortHash = point.geometricHash.substring(0, 6);
                ctx.fillStyle = '#343A40';
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(shortHash, x, y + size + 10);
            }
        });

        // 🔥 ПОДПИСЬ МАСШТАБА
        ctx.fillStyle = '#6C757D';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`Геометрических точек: ${points.length}`, canvasWidth - 20, 40);
    }

    // 🔥 МЕТОД: ВЫЧИСЛЕНИЕ ГРАНИЦ ДЛЯ АККУМУЛЯТОРА
    calculateAccumulatorBounds(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 100, minY: 0, maxY: 100, centerX: 50, centerY: 50 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        points.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });

        // Добавляем отступы
        const padding = Math.max(50, (maxX - minX) * 0.1, (maxY - minY) * 0.1);
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;

        return {
            minX, maxX, minY, maxY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }

    // 🔥 МЕТОД: ВЫЧИСЛЕНИЕ МАСШТАБА ДЛЯ АККУМУЛЯТОРА
    calculateAccumulatorScale(bounds, targetWidth, targetHeight) {
        const width = Math.max(1, bounds.maxX - bounds.minX);
        const height = Math.max(1, bounds.maxY - bounds.minY);

        const scaleX = targetWidth / width;
        const scaleY = targetHeight / height;

        return Math.min(scaleX, scaleY, 3); // Максимальный масштаб 3x
    }

    // 🔥 МЕТОД: ЦВЕТ ДЛЯ ТОЧКИ АККУМУЛЯТОРА
    getAccumulatorPointColor(confirmations) {
        if (confirmations >= 3) {
            return this.config.pointColors.confirmed3; // 🔴
        } else if (confirmations >= 2) {
            return this.config.pointColors.confirmed2; // 🟠
        } else {
            return this.config.pointColors.confirmed1; // 🔵
        }
    }

    // 🔥 МЕТОД: РАЗМЕР ДЛЯ ТОЧКИ АККУМУЛЯТОРА
    calculateAccumulatorPointSize(confirmations, confidence) {
        let baseSize = 5;

        // Размер зависит от количества подтверждений
        if (confirmations >= 3) {
            baseSize = 12; // Большие для высоконадежных точек
        } else if (confirmations >= 2) {
            baseSize = 8;
        } else {
            baseSize = 6;
        }

        // Корректировка по уверенности
        return baseSize + (confidence * 4);
    }

    // 🔥 МЕТОД: ЛЕГЕНДА ДЛЯ АККУМУЛЯТОРА
    drawAccumulatorLegend(ctx, canvasWidth, canvasHeight) {
        const legendY = canvasHeight - 150;
        const startX = canvasWidth * 0.1;
        const columnWidth = canvasWidth * 0.25;

        // Фон легенды
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(startX - 10, legendY - 20, canvasWidth * 0.8, 130);

        ctx.strokeStyle = '#DEE2E6';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX - 10, legendY - 20, canvasWidth * 0.8, 130);

        // Заголовок
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📋 ЛЕГЕНДА ГЕОМЕТРИЧЕСКОГО АККУМУЛЯТОРА', startX, legendY);

        // Элементы легенды
        const legendItems = [
            {
                confirmations: 3,
                color: this.config.pointColors.confirmed3,
                text: '3+ подтверждений',
                description: 'Высокая надежность, есть в 3+ фото'
            },
            {
                confirmations: 2,
                color: this.config.pointColors.confirmed2,
                text: '2 подтверждения',
                description: 'Средняя надежность, есть в 2 фото'
            },
            {
                confirmations: 1,
                color: this.config.pointColors.confirmed1,
                text: '1 подтверждение',
                description: 'Новая точка, только в 1 фото',
                showNew: true
            },
            {
                confirmations: 3,
                color: this.config.pointColors.confirmed3,
                text: 'N - новая точка',
                description: 'Добавлена в последнем фото'
            }
        ];

        legendItems.forEach((item, index) => {
            const x = startX + (index % 2) * columnWidth;
            const y = legendY + 25 + Math.floor(index / 2) * 45;

            // Рисуем пример точки
            const size = this.calculateAccumulatorPointSize(item.confirmations, 0.7);

            // Внешний круг
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(x + 15, y + 8, size, 0, Math.PI * 2);
            ctx.fill();

            // Обводка
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Внутренний круг и текст для подтверждений
            if (item.confirmations >= 2) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x + 15, y + 8, size * 0.5, 0, Math.PI * 2);
                ctx.fill();

                // Число подтверждений
                ctx.fillStyle = item.color;
                ctx.font = 'bold 9px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.confirmations.toString(), x + 15, y + 8);
            }

            // Буква N для новых точек
            if (item.showNew) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x + 15, y + 8, size * 0.4, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = item.color;
                ctx.font = 'bold 9px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('N', x + 15, y + 8);
            }

            // Текст
            ctx.fillStyle = '#495057';
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(item.text, x + 35, y + 5);

            ctx.fillStyle = '#6C757D';
            ctx.font = '11px Arial';
            ctx.fillText(item.description, x + 35, y + 20);
        });
    }

    // 🔥 МЕТОД: ТЕКСТОВЫЙ ОТЧЕТ ДЛЯ АККУМУЛЯТОРА
    createAccumulatorTextReport(accumulatorData, options = {}) {
        const stats = accumulatorData.stats || {};
        const points = accumulatorData.points || [];

        const outputDir = options.outputDir || this.config.outputDir;
        const filename = options.filename || `accumulator_report_${Date.now()}.txt`;
        const outputPath = path.join(outputDir, filename);

        let report = `🎯 ОТЧЕТ ГЕОМЕТРИЧЕСКОГО АККУМУЛЯТОРА\n`;
        report += `══════════════════════════════════════════════════════\n\n`;

        report += `👤 ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ:\n`;
        report += `├─ ID пользователя: ${accumulatorData.userId || 'unknown'}\n`;
        report += `├─ ID аккумулятора: ${accumulatorData.id || 'unknown'}\n`;
        report += `├─ Название: ${accumulatorData.name || 'Аккумулятор'}\n`;
        report += `└─ Тип: Геометрическая аккумуляция\n\n`;

        report += `📊 СТАТИСТИКА АККУМУЛЯТОРА:\n`;
        report += `├─ Всего уникальных геометрических точек: ${stats.totalUniquePoints || 0}\n`;
        report += `├─ 🔴 3+ подтверждений: ${stats.byConfirmations?.['3+'] || 0}\n`;
        report += `├─ 🟠 2 подтверждения: ${stats.byConfirmations?.['2'] || 0}\n`;
        report += `├─ 🔵 1 подтверждение: ${stats.byConfirmations?.['1'] || 0}\n`;
        report += `├─ 📈 Всего следов: ${accumulatorData.totalFootprints || 1}\n`;
        report += `├─ 📅 Создан: ${stats.createdAt ? new Date(stats.createdAt).toLocaleString('ru-RU') : 'неизвестно'}\n`;
        report += `└─ 🔄 Последнее обновление: ${stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString('ru-RU') : 'неизвестно'}\n\n`;

        report += `🎯 ИНФОРМАЦИЯ О СРАВНЕНИИ:\n`;
        if (options.comparisonResult) {
            const comp = options.comparisonResult;
            report += `├─ Сходство: ${(comp.similarity * 100).toFixed(1)}%\n`;
            report += `├─ Решение: ${comp.decision || 'unknown'}\n`;
            report += `├─ Общие точки: ${comp.commonPoints || 0}\n`;
            report += `└─ Порог совпадения: 60%\n`;
        } else {
            report += `└─ Нет данных о сравнении\n`;
        }
        report += `\n`;

        report += `📋 ЛЕГЕНДА ЦВЕТОВ:\n`;
        report += `├─ 🔴 Красный: 3+ подтверждений (высокая надежность)\n`;
        report += `├─ 🟠 Оранжевый: 2 подтверждения (средняя надежность)\n`;
        report += `├─ 🔵 Синий: 1 подтверждение (новая точка)\n`;
        report += `└─ N - новая точка (добавлена в последнем фото)\n\n`;

        report += `📈 ТОЧКИ С ВЫСОКОЙ НАДЕЖНОСТЬЮ (3+ подтверждений):\n`;
        const highConfidencePoints = points.filter(p => p.confirmations >= 3);
        if (highConfidencePoints.length > 0) {
            highConfidencePoints.slice(0, 10).forEach((point, index) => {
                const shortHash = point.geometricHash ? point.geometricHash.substring(0, 8) : 'нет хеша';
                report += `${index + 1}. Хеш: ${shortHash}, подтверждений: ${point.confirmations}\n`;
            });
            if (highConfidencePoints.length > 10) {
                report += `... и еще ${highConfidencePoints.length - 10} точек\n`;
            }
        } else {
            report += `└─ Нет точек с 3+ подтверждениями\n`;
        }
        report += `\n`;

        report += `💡 СИСТЕМА ГЕОМЕТРИЧЕСКОЙ АККУМУЛЯЦИИ:\n`;
        report += `├─ Каждая точка = геометрический хеш\n`;
        report += `├─ НЕТ трансформаций, поворотов, нормализаций\n`;
        report += `├─ Аккумуляция всех точек из всех фото\n`;
        report += `├─ Сравнение по геометрическим хешам\n`;
        report += `└─ Цвет показывает количество подтверждений\n\n`;

        report += `══════════════════════════════════════════════════════\n`;
        report += `Отчет создан: ${new Date().toLocaleString('ru-RU')}\n`;

        fs.writeFileSync(outputPath, report, 'utf8');

        console.log(`📄 Текстовый отчет аккумулятора сохранен: ${outputPath}`);

        return {
            path: outputPath,
            stats: stats,
            pointsCount: points.length,
            note: 'Текстовый отчет геометрического аккумулятора'
        };
    }

    // 🔥 СУЩЕСТВУЮЩИЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ

    async visualizeAccumulativeModel(accumulativeData, footprint, options = {}) {
        console.log('🎨 [Совместимость] Визуализация аккумулятивной модели...');
       
        // Преобразуем формат для новой визуализации
        const accumulatorData = {
            id: accumulativeData.id || `accum_${Date.now()}`,
            userId: footprint?.userId || 'unknown',
            name: footprint?.name || 'Аккумулятор',
            points: accumulativeData.points || [],
            stats: accumulativeData.stats || {},
            totalFootprints: accumulativeData.totalFootprints || 1
        };
       
        return this.visualizeAccumulator(accumulatorData, options);
    }

    async visualizeSingleFootprintConfirmations(footprint, options = {}) {
        console.log('🎨 [Совместимость] Визуализация одного следа...');

        try {
            // Преобразуем старый формат в аккумуляторный
            const points = this.getEnhancedPoints(footprint, options.matchInfo);
            const stats = this.calculateEnhancedConfirmationStats(points, options.matchInfo);

            const accumulatorData = {
                id: footprint.id || `fp_${Date.now()}`,
                userId: footprint.userId || 'unknown',
                name: footprint.name || 'След',
                points: points.map(p => ({
                    ...p,
                    confirmations: p.confirmedCount || 1,
                    color: p.color || this.getAccumulatorPointColor(p.confirmedCount || 1),
                    size: p.size || this.calculateAccumulatorPointSize(p.confirmedCount || 1, p.confidence || 0.5)
                })),
                stats: {
                    totalUniquePoints: points.length,
                    byConfirmations: {
                        '3+': stats.confirmed3 || 0,
                        '2': stats.confirmed2 || 0,
                        '1': stats.confirmed1 || 0
                    }
                },
                totalFootprints: 1
            };

            return await this.visualizeAccumulator(accumulatorData, {
                ...options,
                comparisonResult: options.comparisonResult
            });

        } catch (error) {
            console.log('⚠️ Ошибка совместимой визуализации:', error.message);
            return null;
        }
    }

    async visualizeAccumulativeFootprint(accumulatorData, options = {}) {
        console.log('🎨 [Совместимость] Визуализация аккумуляторного следа...');
        return this.visualizeAccumulator(accumulatorData, options);
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (без изменений)

    getEnhancedPoints(footprint, matchInfo = null) {
        const enhancedPoints = [];

        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [id, point] of footprint.pointTracker.points) {
                enhancedPoints.push({
                    id,
                    x: point.x,
                    y: point.y,
                    confirmedCount: point.confirmedCount || 1,
                    confidence: point.rating || point.confidence || 0.5,
                    source: 'point_tracker'
                });
            }
        }

        return enhancedPoints;
    }

    calculateEnhancedConfirmationStats(points, matchInfo = null) {
        let confirmed3 = 0, confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;

        points.forEach(point => {
            const confirmations = point.confirmedCount || 0;

            if (confirmations >= 3) {
                confirmed3++;
            } else if (confirmations >= 2) {
                confirmed2++;
            } else if (confirmations >= 1) {
                confirmed1++;
            } else {
                confirmed0++;
            }
        });

        return {
            total: points.length,
            confirmed3,
            confirmed2,
            confirmed1,
            confirmed0
        };
    }

    async visualizeComparison(footprint1, footprint2, options = {}) {
        console.log('🎨 [Совместимость] Визуализация сравнения...');

        try {
            const canvas = require('canvas');
            const canvasWidth = options.width || 1200;
            const canvasHeight = options.height || 800;

            const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
            const ctx = canvasInstance.getContext('2d');

            // Фон
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Заголовок
            ctx.fillStyle = '#212529';
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🔍 СРАВНЕНИЕ СЛЕДОВ', canvasWidth / 2, 50);

            // Сохраняем
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
                        success: true
                    });
                });

                out.on('error', reject);
            });

        } catch (error) {
            console.error('❌ Ошибка визуализации сравнения:', error);
            return null;
        }
    }

    async visualizeTwoFootprintComparison(footprint1, footprint2, options = {}) {
        console.log('🎨 [Совместимость] Визуализация сравнения двух следов...');
        return await this.visualizeComparison(footprint1, footprint2, options);
    }
}

module.exports = ClusterVisualizer;
