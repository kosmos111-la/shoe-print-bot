// modules/footprint/visualizations/cluster-visualizer.js
// 🔥 ДОБАВЛЕНА АККУМУЛЯТОРНАЯ ВИЗУАЛИЗАЦИЯ ДЛЯ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/clusters',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,

            // 🔥 ЦВЕТА ДЛЯ АККУМУЛЯТОРНОЙ МОДЕЛИ (ГЕОМЕТРИЧЕСКИЕ ПАСПОРТА)
            pointColors: {
                confirmed3: '#FF0000',   // 🔴 Красный: 3+ подтверждений
                confirmed2: '#FF6B00',   // 🟠 Оранжевый: 2 подтверждения
                confirmed1: '#2196F3',   // 🔵 Синий: 1 подтверждение
                confirmed0: '#BDBDBD',   // ⚪ Серый: 0 подтверждений (резерв)
                background: '#FFFFFF'    // Белый фон
            },

            legendPosition: options.legendPosition || 'bottom',
            showStats: options.showStats !== false,
            debug: options.debug || false,

            // 🔥 НАСТРОЙКИ ДЛЯ АККУМУЛЯТОРА ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ
            accumulativeMode: true,
            showPhotoHistory: true,
            geometricPassports: true, // 🔥 ФЛАГ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ

            ...options
        };

        // Создаем директорию
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }

        console.log('🎨 ClusterVisualizer создан с аккумуляторной визуализацией для геометрических паспортов');
    }

    // 🔥 НОВЫЙ МЕТОД: ВИЗУАЛИЗАЦИЯ АККУМУЛЯТОРНОЙ МОДЕЛИ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ
    async visualizeAccumulativeModel(accumulativeData, footprint, options = {}) {
        console.log('🎨 Визуализация аккумуляционной модели геометрических паспортов...');

        try {
            // Проверяем доступность canvas
            let canvas;
            try {
                canvas = require('canvas');
            } catch (error) {
                console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
                return this.createAccumulativeTextReport(accumulativeData, options);
            }

            // Создаем canvas
            const canvasWidth = options.width || 1000;
            const canvasHeight = options.height || 800;

            const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
            const ctx = canvasInstance.getContext('2d');

            // 1. ФОН С ГРАДИЕНТОМ
            const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
            gradient.addColorStop(0, '#F8F9FA');
            gradient.addColorStop(1, '#E9ECEF');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 2. ЗАГОЛОВОК
            ctx.fillStyle = '#212529';
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`👣 АККУМУЛЯЦИОННАЯ МОДЕЛЬ: ${footprint.name || 'Геометрические паспорта'}`, canvasWidth / 2, 45);

            // 3. СТАТИСТИКА ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ
            const stats = accumulativeData.stats || {};
            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = '#343A40';
            ctx.textAlign = 'left';
            ctx.fillText('📊 СТАТИСТИКА ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ:', 50, 90);

            const statRows = [
                `Всего уникальных геометрических паспортов: ${stats.totalPassports || 0}`,
                `🔴 3+ подтверждений (высокая надежность): ${stats.byConfirmations?.['3+'] || stats.confirmed3 || 0}`,
                `🟠 2 подтверждения (средняя надежность): ${stats.byConfirmations?.['2'] || stats.confirmed2 || 0}`,
                `🔵 1 подтверждение (новая точка): ${stats.byConfirmations?.['1'] || stats.confirmed1 || 0}`,
                `📈 Всего следов: ${accumulativeData.totalFootprints || 1}`
            ];

            ctx.font = '18px Arial';
            ctx.fillStyle = '#495057';
            statRows.forEach((text, index) => {
                ctx.fillText(text, 70, 130 + index * 32);
            });

            // 4. ИНФОРМАЦИЯ О СИСТЕМЕ
            ctx.fillStyle = '#6C757D';
            ctx.font = '14px Arial';
            ctx.textAlign = 'right';
            ctx.fillText('🎯 Система геометрических паспортов', canvasWidth - 20, 90);

            // 5. 🔥 РИСУЕМ ВСЕ ТОЧКИ ИЗ АККУМУЛЯЦИОННОЙ МОДЕЛИ
            this.drawAccumulativePoints(ctx, accumulativeData.points || [], canvasWidth, canvasHeight);

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

            // 7. 🔥 УЛУЧШЕННАЯ ЛЕГЕНДА ДЛЯ АККУМУЛЯТОРА ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ
            this.drawAccumulativeLegend(ctx, canvasWidth, canvasHeight, true);

            // 8. ИНФОРМАЦИЯ О СИСТЕМЕ
            ctx.fillStyle = '#ADB5BD';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(
                `🎯 Геометрические паспорта | Инвариантная система | ${new Date().toLocaleString('ru-RU')}`,
                canvasWidth / 2,
                canvasHeight - 20
            );

            // 9. СОХРАНЯЕМ
            const filename = options.filename || `accumulative_${Date.now()}.png`;
            const outputPath = path.join(this.config.outputDir, filename);

            return new Promise((resolve, reject) => {
                const out = fs.createWriteStream(outputPath);
                const stream = canvasInstance.createPNGStream();

                stream.pipe(out);

                out.on('finish', () => {
                    console.log(`✅ Аккумуляторная визуализация сохранена: ${outputPath}`);
                    resolve({
                        path: outputPath,
                        stats: stats,
                        pointsCount: accumulativeData.points?.length || 0,
                        success: true,
                        geometricPassports: true,
                        modelType: 'accumulative'
                    });
                });

                out.on('error', reject);
            });

        } catch (error) {
            console.error('❌ Ошибка визуализации аккумулятора геометрических паспортов:', error);
            return this.createAccumulativeTextReport(accumulativeData, options);
        }
    }

    // 🔥 НОВЫЙ МЕТОД: РИСОВАНИЕ ТОЧЕК ИЗ АККУМУЛЯЦИОННОЙ МОДЕЛИ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ
    drawAccumulativePoints(ctx, points, canvasWidth, canvasHeight) {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight * 0.65;

        if (points.length === 0) {
            ctx.fillStyle = '#6C757D';
            ctx.font = '20px Arial';
            ctx.fillText('Нет геометрических паспортов для отображения', centerX, centerY);
            return;
        }

        // Вычисляем границы для масштабирования
        const { minX, maxX, minY, maxY } = this.calculateBounds(points);
        const scale = this.calculateScale(minX, maxX, minY, maxY, canvasWidth * 0.7, canvasHeight * 0.4);

        console.log(`🎨 Рисую ${points.length} геометрических паспортов из аккумулятора`);

        // Рисуем каждую точку
        points.forEach(point => {
            const x = centerX + (point.x - (minX + maxX) / 2) * scale;
            const y = centerY + (point.y - (minY + maxY) / 2) * scale;

            // Используем цвет и размер из данных или вычисляем
            const color = point.color || this.getAccumulativePointColor(point.confirmations || 1);
            const size = point.size || this.calculateAccumulativePointSize(point.confirmations || 1, point.confidence || 0.5);

            // Рисуем внешний круг (геометрический паспорт)
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            // Обводка для лучшей видимости
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Внутренний круг для паспортов с 2+ подтверждениями
            if (point.confirmations >= 2) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }

            // 🔥 ПОДПИСЬ КОЛИЧЕСТВА ПОДТВЕРЖДЕНИЙ (для паспортов с 2+)
            if (point.confirmations >= 2) {
                ctx.fillStyle = color;
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(point.confirmations.toString(), x, y);
            }

            // 🔥 ИКОНКА ГЕОМЕТРИЧЕСКОГО ПАСПОРТА ДЛЯ НОВЫХ ТОЧЕК
            if (point.confirmations === 1) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
                ctx.fill();

                // Буква G для геометрического паспорта
                ctx.fillStyle = color;
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('G', x, y);
            }

            // 🔥 ХЕШ ГЕОМЕТРИЧЕСКОГО ПАСПОРТА (короткая версия)
            if (point.geometricHash && point.confirmations >= 3) {
                const shortHash = point.geometricHash.substring(0, 4);
                ctx.fillStyle = '#343A40';
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(shortHash, x, y + size + 8);
            }
        });

        // 🔥 ПОДПИСЬ МАСШТАБА
        ctx.fillStyle = '#6C757D';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`Геометрических паспортов: ${points.length}`, canvasWidth - 20, 40);
    }

    // 🔥 НОВЫЙ МЕТОД: ЦВЕТ ДЛЯ АККУМУЛЯТОРНОЙ ТОЧКИ (ГЕОМЕТРИЧЕСКОГО ПАСПОРТА)
    getAccumulativePointColor(confirmations) {
        if (confirmations >= 3) {
            return this.config.pointColors.confirmed3;
        } else if (confirmations >= 2) {
            return this.config.pointColors.confirmed2;
        } else {
            return this.config.pointColors.confirmed1;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: РАЗМЕР ДЛЯ АККУМУЛЯТОРНОЙ ТОЧКИ (ГЕОМЕТРИЧЕСКОГО ПАСПОРТА)
    calculateAccumulativePointSize(confirmations, confidence) {
        let baseSize = 4;

        // Размер зависит от количества подтверждений
        if (confirmations >= 3) {
            baseSize = 12; // Большие для высоконадежных паспортов
        } else if (confirmations >= 2) {
            baseSize = 8;
        } else {
            baseSize = 6;
        }

        // Корректировка по уверенности
        return baseSize + (confidence * 4);
    }

    // 🔥 НОВЫЙ МЕТОД: ЛЕГЕНДА ДЛЯ АККУМУЛЯТОРА ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ
    drawAccumulativeLegend(ctx, canvasWidth, canvasHeight, geometricPassports = true) {
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
        const legendTitle = geometricPassports
            ? '📋 ЛЕГЕНДА ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ'
            : '📋 ЛЕГЕНДА АККУМУЛЯТОРНОЙ МОДЕЛИ';
        ctx.fillText(legendTitle, startX, legendY);

        // Элементы легенды для геометрических паспортов
        const legendItems = geometricPassports ? [
            {
                confirmations: 3,
                color: this.config.pointColors.confirmed3,
                text: '3+ подтверждений',
                description: 'Высокая надежность, геометрический паспорт'
            },
            {
                confirmations: 2,
                color: this.config.pointColors.confirmed2,
                text: '2 подтверждения',
                description: 'Средняя надежность, геометрический паспорт'
            },
            {
                confirmations: 1,
                color: this.config.pointColors.confirmed1,
                text: '1 подтверждение',
                description: 'Новый геометрический паспорт',
                showNew: true,
                newText: 'G'
            },
            {
                confirmations: 3,
                color: this.config.pointColors.confirmed3,
                text: 'Хеш паспорта',
                description: 'Короткий ID геометрического паспорта'
            }
        ] : [
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
                description: 'Низкая надежность, есть в 1 фото'
            }
        ];

        legendItems.forEach((item, index) => {
            const x = startX + (index % 2) * columnWidth;
            const y = legendY + 25 + Math.floor(index / 2) * 45;

            // Рисуем пример точки
            const size = this.calculateAccumulativePointSize(item.confirmations, 0.7);

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
                ctx.arc(x + 15, y + 8, size * 0.4, 0, Math.PI * 2);
                ctx.fill();

                // Число подтверждений
                ctx.fillStyle = item.color;
                ctx.font = 'bold 9px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.confirmations.toString(), x + 15, y + 8);
            }

            // Буква G для новых геометрических паспортов
            if (item.showNew && item.newText) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x + 15, y + 8, size * 0.3, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = item.color;
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.newText, x + 15, y + 8);
            }

            // Для демонстрации хеша (четвертый элемент)
            if (index === 3 && geometricPassports) {
                ctx.fillStyle = '#343A40';
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('A1B2', x + 15, y + 8 + size + 6);
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

    // 🔥 НОВЫЙ МЕТОД: ТЕКСТОВЫЙ ОТЧЕТ ДЛЯ АККУМУЛЯТОРА ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ
    createAccumulativeTextReport(accumulativeData, options = {}) {
        const stats = accumulativeData.stats || {};
        const points = accumulativeData.points || [];

        const outputDir = options.outputDir || this.config.outputDir;
        const filename = options.filename || `accumulative_report_${Date.now()}.txt`;
        const outputPath = path.join(outputDir, filename);

        let report = `🎯 ОТЧЕТ АККУМУЛЯЦИОННОЙ МОДЕЛИ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ\n`;
        report += `══════════════════════════════════════════════════════════\n\n`;

        report += `👣 ИНФОРМАЦИЯ О МОДЕЛИ:\n`;
        report += `├─ ID модели: ${accumulativeData.id || 'unknown'}\n`;
        report += `├─ Всего следов: ${accumulativeData.totalFootprints || 1}\n`;
        report += `├─ Тип модели: Геометрические паспорта (инвариантные)\n`;
        report += `└─ Метод: Аккумуляционный\n\n`;

        report += `📊 СТАТИСТИКА ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ:\n`;
        report += `├─ Всего уникальных геометрических паспортов: ${stats.totalPassports || 0}\n`;
        report += `├─ 🔴 3+ подтверждений (высокая надежность): ${stats.byConfirmations?.['3+'] || stats.confirmed3 || 0}\n`;
        report += `├─ 🟠 2 подтверждения (средняя надежность): ${stats.byConfirmations?.['2'] || stats.confirmed2 || 0}\n`;
        report += `├─ 🔵 1 подтверждение (новая точка): ${stats.byConfirmations?.['1'] || stats.confirmed1 || 0}\n`;
        report += `└─ 📈 Всего следов в модели: ${accumulativeData.totalFootprints || 1}\n\n`;

        report += `🎯 ИНФОРМАЦИЯ О ГЕОМЕТРИЧЕСКОМ СРАВНЕНИИ:\n`;
        if (options.comparisonResult) {
            const comp = options.comparisonResult;
            report += `├─ Сходство: ${(comp.similarity * 100).toFixed(1)}%\n`;
            report += `├─ Решение: ${comp.decision || 'unknown'}\n`;
            report += `├─ Метод: ${comp.method || 'geometric_passports'}\n`;
            report += `├─ Совпадений: ${comp.matches?.length || 0}\n`;
            report += `└─ Система: Инвариантная к трансформациям\n`;
        } else {
            report += `└─ Нет данных о сравнении\n`;
        }
        report += `\n`;

        report += `📋 ЛЕГЕНДА ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ:\n`;
        report += `├─ 🔴 Красный: 3+ подтверждений (высокая надежность)\n`;
        report += `├─ 🟠 Оранжевый: 2 подтверждения (средняя надежность)\n`;
        report += `├─ 🔵 Синий: 1 подтверждение (низкая надежность)\n`;
        report += `├─ G - новый геометрический паспорт\n`;
        report += `└─ Хеш - уникальный идентификатор паспорта\n\n`;

        report += `📈 ГЕОМЕТРИЧЕСКИЕ ПАСПОРТА С ВЫСОКОЙ НАДЕЖНОСТЬЮ (3+ подтверждений):\n`;
        const highConfidencePoints = points.filter(p => p.confirmations >= 3);
        if (highConfidencePoints.length > 0) {
            highConfidencePoints.slice(0, 10).forEach((point, index) => {
                const shortHash = point.geometricHash ? point.geometricHash.substring(0, 8) : 'нет';
                report += `${index + 1}. Хеш: ${shortHash}, подтверждений: ${point.confirmations}\n`;
            });
            if (highConfidencePoints.length > 10) {
                report += `... и еще ${highConfidencePoints.length - 10} геометрических паспортов\n`;
            }
        } else {
            report += `└─ Нет геометрических паспортов с 3+ подтверждениями\n`;
        }
        report += `\n`;

        report += `💡 СИСТЕМА ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ:\n`;
        report += `├─ Каждая точка = геометрический паспорт\n`;
        report += `├─ Паспорта инвариантны к поворотам, трансформациям\n`;
        report += `├─ Сравнение по геометрическим хешам\n`;
        report += `├─ Накопление подтверждений из всех фото\n`;
        report += `└─ Цвет показывает надежность (количество подтверждений)\n\n`;

        report += `══════════════════════════════════════════════════════════\n`;
        report += `Отчет создан: ${new Date().toLocaleString('ru-RU')}\n`;

        fs.writeFileSync(outputPath, report, 'utf8');

        console.log(`📄 Текстовый отчет геометрических паспортов сохранен: ${outputPath}`);

        return {
            path: outputPath,
            stats: stats,
            pointsCount: points.length,
            note: 'Текстовый отчет аккумуляционной модели геометрических паспортов'
        };
    }

    // 🔥 СУЩЕСТВУЮЩИЕ МЕТОДЫ (для совместимости)
    async visualizeAccumulativeFootprint(accumulatorData, options = {}) {
        console.log('🎨 [Совместимость] Визуализация аккумуляторного следа...');
       
        // Преобразуем формат для новой модели
        const accumulativeData = {
            id: accumulatorData.id || `accum_${Date.now()}`,
            stats: accumulatorData.stats || {},
            points: accumulatorData.points || [],
            totalFootprints: accumulatorData.totalPhotos || 1
        };
       
        return this.visualizeAccumulativeModel(accumulativeData, {
            id: accumulatorData.id,
            name: accumulatorData.name || 'Аккумуляторный след'
        }, options);
    }

    async visualizeSingleFootprintConfirmations(footprint, options = {}) {
        console.log('🎨 [Совместимость] Визуализация одного следа...');

        try {
            // Преобразуем старый формат в аккумуляторный для визуализации
            const points = this.getEnhancedPoints(footprint, options.matchInfo);
            const stats = this.calculateEnhancedConfirmationStats(points, options.matchInfo);

            const accumulativeData = {
                id: footprint.id || `fp_${Date.now()}`,
                stats: {
                    totalPassports: points.length,
                    byConfirmations: {
                        '3+': stats.confirmed3 || 0,
                        '2': stats.confirmed2 || 0,
                        '1': stats.confirmed1 || 0
                    }
                },
                points: points.map(p => ({
                    ...p,
                    confirmations: p.confirmedCount || 1,
                    color: p.color || this.getAccumulativePointColor(p.confirmedCount || 1),
                    size: p.size || this.calculateAccumulativePointSize(p.confirmedCount || 1, p.confidence || 0.5)
                })),
                totalFootprints: 1
            };

            return await this.visualizeAccumulativeModel(accumulativeData, {
                id: footprint.id,
                name: footprint.name || 'След'
            }, {
                ...options,
                comparisonResult: options.comparisonResult
            });

        } catch (error) {
            console.log('⚠️ Ошибка совместимой визуализации:', error.message);
            return null;
        }
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (без изменений)
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

        return Math.min(scaleX, scaleY, 3);
    }

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

    // 🔥 МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ
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
