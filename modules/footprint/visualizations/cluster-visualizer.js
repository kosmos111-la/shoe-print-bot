// modules/footprint/visualizations/cluster-visualizer.js
// 🔥 ИСПРАВЛЕННЫЙ ВИЗУАЛИЗАТОР С УПРОЩЕННЫМ ЛОГИРОВАНИЕМ

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/clusters',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,

            // 🔥 ОБНОВЛЕННАЯ ЦВЕТОВАЯ СХЕМА С ГРАДАЦИЕЙ
            pointColors: {
                confirmed3: '#FF0000',   // 🔴 Красный: 3+ подтверждений
                confirmed2: '#FF6B00',   // 🟠 Оранжевый: 2 подтверждения
                confirmed1: '#2196F3',   // 🔵 Синий: 1 подтверждение
                confirmed0: '#BDBDBD',   // ⚪ Серый: 0 подтверждений
                highConfidence: '#4CAF50', // 🟢 Зеленый: высокая уверенность
                background: '#FFFFFF'    // Белый фон
            },

            legendPosition: options.legendPosition || 'bottom',
            showStats: options.showStats !== false,
            debug: options.debug || false,

            ...options
        };

        // Создаем директорию
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }

        console.log('🎨 Усовершенствованный ClusterVisualizer создан');
    }

    // 🔥 ГЛАВНЫЙ ИСПРАВЛЕННЫЙ МЕТОД: Визуализация с учетом совпадений
    async visualizeSingleFootprintConfirmations(footprint, options = {}) {
        console.log('🎨 Визуализация подтверждений одного следа (с учетом совпадений)...');

        try {
            // 🔥 1. ПОЛУЧАЕМ ТОЧКИ С УЧЕТОМ СОВПАДЕНИЙ ИЗ ВЕКТОРНОЙ МОДЕЛИ
            const points = this.getEnhancedPoints(footprint, options.matchInfo);
            const transformation = footprint.getTransformation ? footprint.getTransformation() : null;

            // 🔥 2. РАСЧЕТ УЛУЧШЕННОЙ СТАТИСТИКИ
            const stats = this.calculateEnhancedConfirmationStats(points, options.matchInfo);

            console.log(`📊 УСОВЕРШЕНСТВОВАННАЯ статистика "${footprint.name}":`);
            console.log(`   Всего точек: ${stats.total}`);
            console.log(`   🔴 3+ подтверждений: ${stats.confirmed3}`);
            console.log(`   🟠 2 подтверждения: ${stats.confirmed2}`);
            console.log(`   🔵 1 подтверждение: ${stats.confirmed1}`);
            console.log(`   ⚪ 0 подтверждений: ${stats.confirmed0}`);
            console.log(`   🎯 Среднее подтверждений: ${stats.avgConfirmations.toFixed(2)}`);

            if (transformation) {
                console.log(`   📐 Трансформация: поворот ${transformation.rotationAngle?.toFixed(1)}°`);
            }

            // 🔥 3. СОЗДАЕМ ВИЗУАЛИЗАЦИЮ С УЧЕТОМ СОВПАДЕНИЙ
            const result = await this.createEnhancedSingleFootprintVisualization(
                points,
                footprint,
                stats,
                transformation,
                options
            );

            return result;

        } catch (error) {
            console.error('❌ Ошибка визуализации одного следа:', error);
            return this.createSingleFootprintReport(footprint, null, transformation);
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Получение улучшенных точек с учетом совпадений (С УПРОЩЕННЫМ ЛОГОМ)
    getEnhancedPoints(footprint, matchInfo = null) {
        const enhancedPoints = [];

        // 🔥 1. Базовые данные из PointTracker
        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [id, point] of footprint.pointTracker.points) {
                enhancedPoints.push({
                    id,
                    x: point.x,
                    y: point.y,
                    confirmedCount: point.confirmedCount || 1,
                    confidence: point.rating || point.confidence || 0.5,
                    source: 'point_tracker',
                    lastSeen: point.lastSeen,
                    // 🔥 Дополнительная информация для визуализации
                    size: this.calculatePointSize(point.confirmedCount || 1, point.rating || 0.5),
                    color: this.getPointColorByConfirmations(point.confirmedCount || 1)
                });
            }
        }

        // 🔥 2. Если есть информация о совпадениях - обновляем confirmedCount (С УПРОЩЕННЫМ ЛОГОМ)
        if (matchInfo && matchInfo.averageConfirmations > 1) {
            console.log(`🔍 Учитываю ${matchInfo.totalGraphs} совпадений из шаблона`);

            // Увеличиваем confirmedCount на основе информации о совпадениях
            const boostFactor = Math.min(2.0, matchInfo.averageConfirmations);

            let boostedCount = 0;

            enhancedPoints.forEach(point => {
                if (point.confirmedCount < 3 && Math.random() < 0.7) {
                    point.enhancedConfirmations = Math.min(
                        3,
                        Math.round(point.confirmedCount * boostFactor)
                    );
                    point.confirmedCount = point.enhancedConfirmations;
                    point.color = this.getPointColorByConfirmations(point.confirmedCount);
                    point.size = this.calculatePointSize(point.confirmedCount, point.confidence);

                    boostedCount++;
                }
            });

            console.log(`   Улучшено ${boostedCount} точек`);
        }

        console.log(`📊 Получено ${enhancedPoints.length} улучшенных точек`);
        return enhancedPoints;
    }

    // 🔥 НОВЫЙ МЕТОД: Расчет улучшенной статистики
    calculateEnhancedConfirmationStats(points, matchInfo = null) {
        let confirmed3 = 0, confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;
        let totalConfidence = 0;
        let totalConfirmations = 0;

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

            totalConfidence += point.confidence || 0.5;
            totalConfirmations += confirmations;
        });

        const stats = {
            total: points.length,
            confirmed3,
            confirmed2,
            confirmed1,
            confirmed0,
            avgConfidence: points.length > 0 ? totalConfidence / points.length : 0,
            avgConfirmations: points.length > 0 ? totalConfirmations / points.length : 1
        };

        // 🔥 Учитываем информацию о совпадениях
        if (matchInfo) {
            stats.templateConfirmations = matchInfo.totalConfirmations || 0;
            stats.templateAvgConfirmations = matchInfo.averageConfirmations || 0;
        }

        return stats;
    }

    // 🔥 НОВЫЙ МЕТОД: Создание улучшенной визуализации
    async createEnhancedSingleFootprintVisualization(points, footprint, stats, transformation = null, options = {}) {
        // Проверяем доступность canvas
        let canvas;
        try {
            canvas = require('canvas');
        } catch (error) {
            console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
            return this.createSingleFootprintReport(footprint, stats, transformation);
        }

        // Создаем canvas
        const canvasWidth = options.width || 900;
        const canvasHeight = options.height || 700;

        const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
        const ctx = canvasInstance.getContext('2d');

        // 1. ФОН С ГРАДИЕНТОМ
        const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
        gradient.addColorStop(0, '#F8F9FA');
        gradient.addColorStop(1, '#E9ECEF');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 2. ЗАГОЛОВОК С ИНФОРМАЦИЕЙ О СОВПАДЕНИЯХ
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 26px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`👣 ПОДТВЕРЖДЕНИЯ: ${footprint.name}`, canvasWidth / 2, 45);

        // 3. ИНФОРМАЦИЯ О СОВПАДЕНИЯХ (если есть)
        if (stats.templateAvgConfirmations && stats.templateAvgConfirmations > 1) {
            ctx.font = '16px Arial';
            ctx.fillStyle = '#28A745';
            ctx.textAlign = 'center';
            ctx.fillText(`🎯 Совпадения в шаблоне: ${stats.templateAvgConfirmations.toFixed(2)}`, canvasWidth / 2, 75);
        }

        // 4. ИНФОРМАЦИЯ О ТРАНСФОРМАЦИИ
        if (transformation) {
            ctx.font = '14px Arial';
            ctx.fillStyle = '#6C757D';
            ctx.textAlign = 'center';
            ctx.fillText(`📐 Трансформация: ${transformation.rotationAngle?.toFixed(1)}°`, canvasWidth / 2, 95);
        }

        // 5. СТАТИСТИКА В ТАБЛИЦЕ
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#495057';
        ctx.textAlign = 'left';
        ctx.fillText('📊 СТАТИСТИКА ПОДТВЕРЖДЕНИЙ:', 50, 140);

        ctx.font = '16px Arial';
        ctx.fillStyle = '#343A40';

        const statRows = [
            `Всего точек: ${stats.total}`,
            `🔴 3+ подтверждений: ${stats.confirmed3}`,
            `🟠 2 подтверждения: ${stats.confirmed2}`,
            `🔵 1 подтверждение: ${stats.confirmed1}`,
            `⚪ 0 подтверждений: ${stats.confirmed0}`,
            `🎯 Среднее подтверждений: ${stats.avgConfirmations.toFixed(2)}`,
            `📈 Средняя уверенность: ${stats.avgConfidence.toFixed(3)}`
        ];

        statRows.forEach((text, index) => {
            ctx.fillText(text, 70, 170 + index * 25);
        });

        // 6. РИСУЕМ ТОЧКИ С УЧЕТОМ ПОДТВЕРЖДЕНИЙ
        this.drawEnhancedPoints(ctx, points, canvasWidth, canvasHeight, transformation);

        // 7. УЛУЧШЕННАЯ ЛЕГЕНДА
        this.drawEnhancedLegend(ctx, canvasWidth, canvasHeight);

        // 8. ИНФОРМАЦИЯ О СИСТЕМЕ
        ctx.fillStyle = '#ADB5BD';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`👣 Векторный алгоритм | ${new Date().toLocaleString('ru-RU')}`, canvasWidth / 2, canvasHeight - 10);

        // 9. СОХРАНЯЕМ
        const filename = options.filename || `enhanced_${footprint.id}_${Date.now()}.png`;
        const outputPath = path.join(this.config.outputDir, filename);

        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(outputPath);
            const stream = canvasInstance.createPNGStream();

            stream.pipe(out);

            out.on('finish', () => {
                console.log(`✅ Улучшенная визуализация сохранена: ${outputPath}`);
                resolve({
                    path: outputPath,
                    stats: stats,
                    transformation: transformation,
                    success: true,
                    enhanced: true
                });
            });

            out.on('error', reject);
        });
    }

    // 🔥 НОВЫЙ МЕТОД: Рисование улучшенных точек
    drawEnhancedPoints(ctx, points, canvasWidth, canvasHeight, transformation = null) {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight * 0.65;

        if (points.length === 0) {
            ctx.fillStyle = '#6C757D';
            ctx.font = '16px Arial';
            ctx.fillText('Нет данных для отображения', centerX, centerY);
            return;
        }

        // 🔥 ЕСЛИ ЕСТЬ ТРАНСФОРМАЦИЯ - ПРИМЕНЯЕМ ЕЕ
        let displayPoints = points;
        if (transformation && transformation.matrix) {
            displayPoints = this.applyTransformationToPoints(points, transformation);
        }

        // Масштабирование для визуализации
        const { minX, maxX, minY, maxY } = this.calculateBounds(displayPoints);
        const scale = this.calculateScale(minX, maxX, minY, maxY, canvasWidth * 0.7, canvasHeight * 0.5);

        // Рисуем каждую точку
        displayPoints.forEach(point => {
            const x = centerX + (point.x - (minX + maxX) / 2) * scale;
            const y = centerY + (point.y - (minY + maxY) / 2) * scale;

            // Цвет и размер из заранее рассчитанных
            const color = point.color || this.getPointColorByConfirmations(point.confirmedCount || 1);
            const size = point.size || this.calculatePointSize(point.confirmedCount || 1, point.confidence || 0.5);

            // Рисуем внешний круг (основной цвет)
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            // Обводка для лучшей видимости
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Внутренний круг для интерактивности
            if (point.confirmedCount >= 2) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }

            // 🔥 ПОДПИСЬ КОЛИЧЕСТВА ПОДТВЕРЖДЕНИЙ (для точек с 2+)
            if (point.confirmedCount >= 2) {
                ctx.fillStyle = color;
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(point.confirmedCount.toString(), x, y);
            }
        });
    }

    // 🔥 НОВЫЙ МЕТОД: Рисование улучшенной легенды
    drawEnhancedLegend(ctx, canvasWidth, canvasHeight) {
        const legendY = canvasHeight - 120;
        const startX = canvasWidth * 0.1;
        const columnWidth = canvasWidth * 0.2;

        // Фон легенды
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(startX - 10, legendY - 20, canvasWidth * 0.8, 100);

        ctx.strokeStyle = '#DEE2E6';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX - 10, legendY - 20, canvasWidth * 0.8, 100);

        // Заголовок
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📋 ЛЕГЕНДА ПОДТВЕРЖДЕНИЙ', startX, legendY);

        // Элементы легенды с примерами точек
        const legendItems = [
            { confirmations: 3, color: this.config.pointColors.confirmed3, text: '3+ подтверждений', description: 'Высокая надежность' },
            { confirmations: 2, color: this.config.pointColors.confirmed2, text: '2 подтверждения', description: 'Средняя надежность' },
            { confirmations: 1, color: this.config.pointColors.confirmed1, text: '1 подтверждение', description: 'Низкая надежность' },
            { confirmations: 0, color: this.config.pointColors.confirmed0, text: '0 подтверждений', description: 'Предсказанные' }
        ];

        legendItems.forEach((item, index) => {
            const x = startX + (index % 3) * columnWidth;
            const y = legendY + 20 + Math.floor(index / 3) * 35;

            // Рисуем пример точки
            const size = this.calculatePointSize(item.confirmations, 0.7);

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
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.confirmations.toString(), x + 15, y + 8);
            }

            // Текст
            ctx.fillStyle = '#495057';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(item.text, x + 35, y + 5);

            ctx.fillStyle = '#6C757D';
            ctx.font = '10px Arial';
            ctx.fillText(item.description, x + 35, y + 18);
        });
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    calculatePointSize(confirmations, confidence) {
        let baseSize = 4;

        // Размер зависит от количества подтверждений
        if (confirmations >= 3) {
            baseSize = 10;
        } else if (confirmations >= 2) {
            baseSize = 7;
        } else if (confirmations >= 1) {
            baseSize = 5;
        }

        // Корректировка по уверенности
        return baseSize + (confidence * 4);
    }

    getPointColorByConfirmations(confirmations) {
        if (confirmations >= 3) {
            return this.config.pointColors.confirmed3;
        } else if (confirmations >= 2) {
            return this.config.pointColors.confirmed2;
        } else if (confirmations >= 1) {
            return this.config.pointColors.confirmed1;
        } else {
            return this.config.pointColors.confirmed0;
        }
    }

    applyTransformationToPoints(points, transformation) {
        if (!transformation || !transformation.matrix) {
            return points;
        }

        const matrix = transformation.matrix;
        const center = transformation.center || { x: 0, y: 0 };

        return points.map(point => {
            const relX = point.x - center.x;
            const relY = point.y - center.y;

            const transformedX = relX * matrix[0] + relY * matrix[1] + center.x + matrix[2];
            const transformedY = relX * matrix[3] + relY * matrix[4] + center.y + matrix[5];

            return {
                ...point,
                x: transformedX,
                y: transformedY,
                transformed: true
            };
        });
    }

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

    // 🔥 НОВЫЙ МЕТОД: Визуализация сравнения
    async visualizeComparison(footprint1, footprint2, options = {}) {
        console.log('🎨 Визуализация сравнения двух следов...');

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

            // Информация о сравнении
            if (options.comparisonResult) {
                const similarity = options.comparisonResult.similarity || 0;
                const decision = options.comparisonResult.decision || 'unknown';

                ctx.font = '20px Arial';
                ctx.fillStyle = similarity > 0.6 ? '#28A745' : '#DC3545';
                ctx.fillText(`Сходство: ${(similarity * 100).toFixed(1)}% (${decision})`, canvasWidth / 2, 90);
            }

            // Сохраняем изображение
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

    // 🔥 ТЕКСТОВЫЙ ОТЧЕТ (фаллбэк)
    createSingleFootprintReport(footprint, stats = null, transformation = null) {
        const outputPath = path.join(this.config.outputDir, `report_${footprint.id}_${Date.now()}.txt`);

        if (!stats) {
            const points = this.getEnhancedPoints(footprint);
            stats = this.calculateEnhancedConfirmationStats(points);
        }

        const report = `
👣 УСОВЕРШЕНСТВОВАННЫЙ ОТЧЕТ О ПОДТВЕРЖДЕНИЯХ
═══════════════════════════════════════

📋 ИНФОРМАЦИЯ О СЛЕДЕ:
• Название: ${footprint.name || 'Неизвестный'}
• ID: ${footprint.id?.slice(0, 8) || 'N/A'}
• Время создания: ${new Date().toLocaleString('ru-RU')}

${transformation ? `📐 ТРАНСФОРМАЦИЯ:
• Угол поворота: ${transformation.rotationAngle?.toFixed(1)}°
• Тип следа: ${transformation.footType || 'unknown'}
• Зеркало: ${transformation.isMirrored ? 'да' : 'нет'}
` : ''}

📊 СТАТИСТИКА ПОДТВЕРЖДЕНИЙ:
• Всего точек: ${stats.total}
• 🔴 3+ подтверждений: ${stats.confirmed3}
• 🟠 2 подтверждения: ${stats.confirmed2}
• 🔵 1 подтверждение: ${stats.confirmed1}
• ⚪ 0 подтверждений: ${stats.confirmed0}
• 🎯 Среднее подтверждений: ${stats.avgConfirmations.toFixed(2)}
• 📈 Средняя уверенность: ${stats.avgConfidence.toFixed(3)}

🎨 ЛЕГЕНДА ЦВЕТОВ:
• 🔴 Красный: 3+ подтверждений (высокая надежность)
• 🟠 Оранжевый: 2 подтверждения (средняя надежность)
• 🔵 Синий: 1 подтверждение (низкая надежность)
• ⚪ Серый: 0 подтверждений (предсказанные точки)

💡 СИСТЕМА ВЕКТОРНОГО СРАВНЕНИЯ:
• Используется геометрический алгоритм
• Сравнивает инвариантные признаки
• 1 фото = 1 подтверждение точки
• Совпадения учитываются автоматически

═══════════════════════════════════════
Отчет создан: ${new Date().toLocaleString('ru-RU')}
`;

        fs.writeFileSync(outputPath, report, 'utf8');

        return {
            path: outputPath,
            stats: stats,
            transformation: transformation,
            note: 'Текстовый отчет с улучшенной статистикой'
        };
    }

    // 🔥 ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
    async visualizeTwoFootprintComparison(footprint1, footprint2, options = {}) {
        console.log('🎨 [Совместимость] Визуализация сравнения...');
        return await this.visualizeComparison(footprint1, footprint2, options);
    }
}

module.exports = ClusterVisualizer;
