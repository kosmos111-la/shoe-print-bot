// modules/footprint/visualizations/cluster-visualizer.js
// 🔥 ВИЗУАЛИЗАТОР АККУМУЛЯТИВНОЙ МОДЕЛИ

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,
           
            // 🔥 ЦВЕТОВАЯ СХЕМА ПО ПОДТВЕРЖДЕНИЯМ
            pointColors: {
                confirmed3: '#FF0000',   // 🔴 Красный: 3+ подтверждений
                confirmed2: '#FF6B00',   // 🟠 Оранжевый: 2 подтверждения
                confirmed1: '#2196F3',   // 🔵 Синий: 1 подтверждение
                background: '#FFFFFF'    // Белый фон
            },
           
            debug: options.debug || false,
            ...options
        };

        // Создаем директорию
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }

        console.log('🎨 ClusterVisualizer создан (аккумулятивная модель)');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Визуализация аккумулятивной модели
    async visualizeAccumulativeModel(modelData, options = {}) {
        console.log('🎨 Визуализация аккумулятивной модели...');

        try {
            // Проверяем доступность canvas
            let canvas;
            try {
                canvas = require('canvas');
            } catch (error) {
                console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
                return this.createTextReport(modelData, options);
            }

            // Создаем canvas
            const canvasWidth = options.width || this.config.canvasWidth;
            const canvasHeight = options.height || this.config.canvasHeight;

            const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
            const ctx = canvasInstance.getContext('2d');

            // 1. ФОН
            ctx.fillStyle = '#F8F9FA';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 2. ЗАГОЛОВОК
            ctx.fillStyle = '#212529';
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('👣 АККУМУЛЯТИВНАЯ МОДЕЛЬ СЛЕДА', canvasWidth / 2, 50);

            // 3. СТАТИСТИКА
            const stats = modelData.stats || {};
            ctx.font = '18px Arial';
            ctx.fillStyle = '#495057';
            ctx.textAlign = 'center';
            ctx.fillText(
                `📊 ${modelData.totalFootprints || 0} следов, ${modelData.totalPoints || 0} уникальных точек`,
                canvasWidth / 2, 90
            );

            // 4. ЛЕГЕНДА СТАТИСТИКИ
            ctx.font = '16px Arial';
            ctx.fillStyle = '#343A40';
            ctx.textAlign = 'left';
           
            const legendX = 50;
            let legendY = 140;
           
            // 🔴 3+ подтверждений
            ctx.fillStyle = this.config.pointColors.confirmed3;
            ctx.beginPath();
            ctx.arc(legendX, legendY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#212529';
            ctx.fillText(`🔴 3+ подтверждений: ${stats.confirmed3 || 0} точек`, legendX + 20, legendY + 5);
           
            // 🟠 2 подтверждения
            ctx.fillStyle = this.config.pointColors.confirmed2;
            ctx.beginPath();
            ctx.arc(legendX, legendY + 35, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#212529';
            ctx.fillText(`🟠 2 подтверждения: ${stats.confirmed2 || 0} точек`, legendX + 20, legendY + 40);
           
            // 🔵 1 подтверждение
            ctx.fillStyle = this.config.pointColors.confirmed1;
            ctx.beginPath();
            ctx.arc(legendX, legendY + 70, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#212529';
            ctx.fillText(`🔵 1 подтверждение: ${stats.confirmed1 || 0} точек`, legendX + 20, legendY + 75);
           
            // Среднее подтверждений
            ctx.fillStyle = '#6C757D';
            ctx.fillText(
                `🎯 Среднее подтверждений: ${stats.avgConfirmations?.toFixed(2) || '0.00'}`,
                legendX, legendY + 110
            );

            // 5. РИСУЕМ ТОЧКИ
            const points = modelData.points || [];
            this.drawAccumulativePoints(ctx, points, canvasWidth, canvasHeight);

            // 6. ИНФОРМАЦИЯ О СИСТЕМЕ
            ctx.fillStyle = '#ADB5BD';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(
                `🎯 Векторная аккумулятивная система | ${new Date().toLocaleString('ru-RU')}`,
                canvasWidth / 2, canvasHeight - 20
            );

            // 7. СОХРАНЯЕМ
            const filename = options.filename || `accumulative_${Date.now()}.png`;
            const outputPath = path.join(this.config.outputDir, filename);

            return new Promise((resolve, reject) => {
                const out = fs.createWriteStream(outputPath);
                const stream = canvasInstance.createPNGStream();

                stream.pipe(out);

                out.on('finish', () => {
                    console.log(`✅ Визуализация сохранена: ${outputPath}`);
                    resolve({
                        path: outputPath,
                        stats: stats,
                        totalPoints: points.length,
                        success: true
                    });
                });

                out.on('error', reject);
            });

        } catch (error) {
            console.error('❌ Ошибка визуализации:', error);
            return this.createTextReport(modelData, options);
        }
    }

    // 🔥 РИСОВАНИЕ ТОЧЕК АККУМУЛЯТИВНОЙ МОДЕЛИ
    drawAccumulativePoints(ctx, points, canvasWidth, canvasHeight) {
        if (points.length === 0) {
            ctx.fillStyle = '#6C757D';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Нет данных для отображения', canvasWidth / 2, canvasHeight / 2);
            return;
        }

        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2 + 50;

        // Находим границы
        const { minX, maxX, minY, maxY } = this.calculateBounds(points);
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);

        // Масштабирование
        const scaleX = (canvasWidth * 0.6) / width;
        const scaleY = (canvasHeight * 0.5) / height;
        const scale = Math.min(scaleX, scaleY, 3);

        // Рисуем каждую точку
        points.forEach(point => {
            const x = centerX + (point.x - (minX + maxX) / 2) * scale;
            const y = centerY + (point.y - (minY + maxY) / 2) * scale;

            // Определяем цвет и размер по подтверждениям
            let color, size;
           
            if (point.confirmations >= 3) {
                color = this.config.pointColors.confirmed3;
                size = 10 + (point.confidence || 0.5) * 4;
            } else if (point.confirmations === 2) {
                color = this.config.pointColors.confirmed2;
                size = 8 + (point.confidence || 0.5) * 3;
            } else {
                color = this.config.pointColors.confirmed1;
                size = 6 + (point.confidence || 0.5) * 2;
            }

            // Используем цвет из данных если есть
            if (point.color === 'red') color = this.config.pointColors.confirmed3;
            else if (point.color === 'orange') color = this.config.pointColors.confirmed2;
            else if (point.color === 'blue') color = this.config.pointColors.confirmed1;

            // Рисуем внешний круг
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            // Обводка для лучшей видимости
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Внутренний круг и цифра для точек с 2+ подтверждениями
            if (point.confirmations >= 2) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
                ctx.fill();

                // Цифра подтверждений
                ctx.fillStyle = color;
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(point.confirmations.toString(), x, y);
            }
        });

        // Рисуем сетку координат (опционально)
        this.drawCoordinateGrid(ctx, centerX, centerY, width * scale, height * scale);
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

    drawCoordinateGrid(ctx, centerX, centerY, width, height) {
        // Тонкая сетка
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 0.5;
       
        // Вертикальные линии
        for (let x = centerX - width/2; x <= centerX + width/2; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, centerY - height/2);
            ctx.lineTo(x, centerY + height/2);
            ctx.stroke();
        }
       
        // Горизонтальные линии
        for (let y = centerY - height/2; y <= centerY + height/2; y += 50) {
            ctx.beginPath();
            ctx.moveTo(centerX - width/2, y);
            ctx.lineTo(centerX + width/2, y);
            ctx.stroke();
        }
       
        // Центральные оси
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
       
        ctx.beginPath();
        ctx.moveTo(centerX - width/2, centerY);
        ctx.lineTo(centerX + width/2, centerY);
        ctx.stroke();
       
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - height/2);
        ctx.lineTo(centerX, centerY + height/2);
        ctx.stroke();
    }

    createTextReport(modelData, options) {
        const outputPath = path.join(this.config.outputDir, `report_${Date.now()}.txt`);
       
        const stats = modelData.stats || {};
        const report = `
👣 ОТЧЕТ АККУМУЛЯТИВНОЙ МОДЕЛИ
═══════════════════════════════════

📋 ИНФОРМАЦИЯ:
• ID модели: ${modelData.modelId || 'N/A'}
• Пользователь: ${modelData.userId || 'N/A'}
• Создана: ${modelData.createdAt?.toLocaleString('ru-RU') || new Date().toLocaleString('ru-RU')}

📊 СТАТИСТИКА:
• Всего следов: ${modelData.totalFootprints || 0}
• Всего уникальных точек: ${modelData.totalPoints || 0}
• 🔴 3+ подтверждений: ${stats.confirmed3 || 0}
• 🟠 2 подтверждения: ${stats.confirmed2 || 0}
• 🔵 1 подтверждение: ${stats.confirmed1 || 0}
• 🎯 Среднее подтверждений: ${stats.avgConfirmations?.toFixed(2) || '0.00'}

🎯 СИСТЕМА:
• Векторная аккумулятивная модель
• 1 след = 1 подтверждение для каждой точки
• Точки накапливаются из всех следов
• Цвет указывает степень подтверждения

🎨 ЦВЕТОВАЯ СХЕМА:
• 🔴 Красный: 3+ подтверждений (высокая надежность)
• 🟠 Оранжевый: 2 подтверждения (средняя надежность)
• 🔵 Синий: 1 подтверждение (низкая надежность)

═══════════════════════════════════
Отчет создан: ${new Date().toLocaleString('ru-RU')}
`;

        fs.writeFileSync(outputPath, report, 'utf8');

        return {
            path: outputPath,
            stats: stats,
            note: 'Текстовый отчет создан'
        };
    }

    // 🔥 ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
    async visualizeSingleFootprintConfirmations(footprint, options = {}) {
        console.log('🎨 [Совместимость] Визуализация одного следа...');
       
        // Преобразуем в формат аккумулятивной модели
        const modelData = {
            modelId: footprint.id,
            totalFootprints: 1,
            totalPoints: footprint.pointTracker?.points?.size || 0,
            points: [],
            stats: {
                confirmed1: footprint.pointTracker?.points?.size || 0,
                confirmed2: 0,
                confirmed3: 0,
                avgConfirmations: 1
            }
        };
       
        // Добавляем точки
        if (footprint.pointTracker?.points) {
            for (const [, point] of footprint.pointTracker.points) {
                modelData.points.push({
                    x: point.x,
                    y: point.y,
                    confidence: point.confidence || 0.5,
                    confirmations: point.confirmedCount || 1,
                    color: 'blue'
                });
            }
        }
       
        return await this.visualizeAccumulativeModel(modelData, options);
    }
}

module.exports = ClusterVisualizer;
