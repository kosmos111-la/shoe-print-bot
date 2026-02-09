// modules/footprint/visualizations/cluster-visualizer.js
// 🔥 ВИЗУАЛИЗАЦИЯ АККУМУЛЯТИВНОЙ МОДЕЛИ

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations',
            ...options
        };

        // Создаем директорию
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }

        console.log('🎨 ClusterVisualizer создан (аккумулятивная модель)');
    }

    // 🔥 ВИЗУАЛИЗАЦИЯ АККУМУЛЯТИВНОЙ МОДЕЛИ
    async visualizeAccumulativeModel(data, options = {}) {
        console.log('🎨 Визуализация аккумулятивной модели...');

        try {
            const canvas = require('canvas');
            const { points, totalPoints, totalFootprints, stats } = data;

            if (!points || points.length === 0) {
                console.log('⚠️ Нет точек для визуализации');
                return this.createTextReport(data, options);
            }

            // Создаем canvas
            const canvasWidth = options.width || 900;
            const canvasHeight = options.height || 700;

            const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
            const ctx = canvasInstance.getContext('2d');

            // 1. ФОН
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // 2. ЗАГОЛОВОК
            ctx.fillStyle = '#212529';
            ctx.font = 'bold 26px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('👣 АККУМУЛЯТИВНАЯ МОДЕЛЬ', canvasWidth / 2, 40);

            // 3. СТАТИСТИКА
            ctx.font = '16px Arial';
            ctx.fillStyle = '#495057';
            ctx.textAlign = 'left';
            ctx.fillText(`📊 Всего точек: ${totalPoints}`, 50, 80);
            ctx.fillText(`📸 Следов: ${totalFootprints}`, 50, 105);

            if (stats) {
                ctx.fillText(`🔴 3+ подтверждений: ${stats.confirmed3 || 0}`, 50, 130);
                ctx.fillText(`🟠 2 подтверждения: ${stats.confirmed2 || 0}`, 50, 155);
                ctx.fillText(`🔵 1 подтверждение: ${stats.confirmed1 || 0}`, 50, 180);
            }

            // 4. РИСУЕМ ТОЧКИ
            this.drawAccumulativePoints(ctx, points, canvasWidth, canvasHeight);

            // 5. ЛЕГЕНДА
            this.drawAccumulativeLegend(ctx, canvasWidth, canvasHeight);

            // 6. СОХРАНЯЕМ
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
                        success: true
                    });
                });

                out.on('error', reject);
            });

        } catch (error) {
            console.log('⚠️ Canvas не доступен:', error.message);
            return this.createTextReport(data, options);
        }
    }

    // 🔥 РИСОВАНИЕ ТОЧЕК
    drawAccumulativePoints(ctx, points, canvasWidth, canvasHeight) {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight * 0.6;

    if (points.length === 0) {
        ctx.fillStyle = '#6C757D';
        ctx.font = '16px Arial';
        ctx.fillText('Нет данных для отображения', centerX, centerY);
        return;
    }

    // Находим границы
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    points.forEach(point => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    });

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    // Масштабирование
    const scaleX = (canvasWidth * 0.7) / width;
    const scaleY = (canvasHeight * 0.5) / height;
    const scale = Math.min(scaleX, scaleY, 3);

    // 🔥 ВАЖНО: Сначала рисуем точки с 1 подтверждением (синие)
    const pointsByConfirmation = {};
   
    points.forEach(point => {
        const conf = point.confirmations || 1;
        if (!pointsByConfirmation[conf]) {
            pointsByConfirmation[conf] = [];
        }
        pointsByConfirmation[conf].push(point);
    });

    // 🔥 РИСУЕМ В ПРАВИЛЬНОМ ПОРЯДКЕ:
    // 1. Сначала синие (1 подтверждение)
    // 2. Затем оранжевые (2 подтверждения)
    // 3. Затем красные (3+ подтверждения)
   
    const drawOrder = [1, 2, 3];
   
    drawOrder.forEach(conf => {
        const pointsToDraw = pointsByConfirmation[conf] || [];
       
        pointsToDraw.forEach(point => {
            const x = centerX + (point.x - (minX + maxX) / 2) * scale;
            const y = centerY + (point.y - (minY + maxY) / 2) * scale;

            // Определяем цвет и размер
            const color = this.getColorByConfirmations(point.confirmations || 1);
            const size = this.getSizeByConfirmations(point.confirmations || 1);

            // Рисуем точку
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            // Обводка
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Число подтверждений для точек с 2+
            if (point.confirmations >= 2) {
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(point.confirmations.toString(), x, y);
            }
        });
    });
}

    // 🔥 ЛЕГЕНДА
    drawAccumulativeLegend(ctx, canvasWidth, canvasHeight) {
        const legendY = canvasHeight - 120;
        const startX = canvasWidth * 0.1;

        // Фон
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(startX - 10, legendY - 20, canvasWidth * 0.8, 100);

        // Заголовок
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📋 ЛЕГЕНДА ПОДТВЕРЖДЕНИЙ', startX, legendY);

        // Элементы
        const items = [
            { confirmations: 3, color: '#FF0000', text: '3+ подтверждений', desc: 'Высокая надежность' },
            { confirmations: 2, color: '#FF6B00', text: '2 подтверждения', desc: 'Средняя надежность' },
            { confirmations: 1, color: '#2196F3', text: '1 подтверждение', desc: 'Низкая надежность' }
        ];

        items.forEach((item, index) => {
            const x = startX + index * 250;
            const y = legendY + 25;

            // Точка-пример
            const size = this.getSizeByConfirmations(item.confirmations);
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(x + 15, y, size, 0, Math.PI * 2);
            ctx.fill();

            // Обводка
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Текст
            ctx.fillStyle = '#495057';
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(item.text, x + 35, y - 5);

            ctx.fillStyle = '#6C757D';
            ctx.font = '12px Arial';
            ctx.fillText(item.desc, x + 35, y + 12);
        });
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    getColorByConfirmations(confirmations) {
        if (confirmations >= 3) return '#FF0000'; // 🔴
        if (confirmations === 2) return '#FF6B00'; // 🟠
        return '#2196F3'; // 🔵
    }

    getSizeByConfirmations(confirmations) {
        if (confirmations >= 3) return 10;
        if (confirmations === 2) return 7;
        return 5;
    }

    // 🔥 ТЕКСТОВЫЙ ОТЧЕТ
    createTextReport(data, options) {
        const { points, totalPoints, totalFootprints, stats } = data;
        const filename = options.filename ? options.filename.replace('.png', '.txt') : `report_${Date.now()}.txt`;
        const outputPath = path.join(this.config.outputDir, filename);

        let report = `📊 ОТЧЕТ АККУМУЛЯТИВНОЙ МОДЕЛИ\n`;
        report += `══════════════════════════\n\n`;
        report += `📅 Дата: ${new Date().toLocaleString('ru-RU')}\n`;
        report += `📊 Всего точек: ${totalPoints}\n`;
        report += `📸 Следов: ${totalFootprints}\n\n`;

        if (stats) {
            report += `🎯 СТАТИСТИКА ПОДТВЕРЖДЕНИЙ:\n`;
            report += `├─ 🔴 3+ подтверждений: ${stats.confirmed3 || 0}\n`;
            report += `├─ 🟠 2 подтверждения: ${stats.confirmed2 || 0}\n`;
            report += `└─ 🔵 1 подтверждение: ${stats.confirmed1 || 0}\n\n`;
        }

        if (points && points.length > 0) {
            report += `📍 ПРИМЕРЫ ТОЧЕК (первые 5):\n`;
            points.slice(0, 5).forEach((point, i) => {
                report += `${i + 1}. (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) - ${point.confirmations} подтверждений\n`;
            });
        }

        report += `\n══════════════════════════\n`;
        report += `ВЕКТОРНАЯ АККУМУЛЯТИВНАЯ СИСТЕМА\n`;

        fs.writeFileSync(outputPath, report, 'utf8');

        return {
            path: outputPath,
            success: true,
            note: 'Текстовый отчет'
        };
    }

    // 🔥 ДЛЯ СОВМЕСТИМОСТИ
    async visualizeSingleFootprintConfirmations(footprint, options = {}) {
        console.log('🎨 Совместимость: визуализация одного следа');
       
        // Преобразуем в формат аккумулятивной модели
        const points = [];
        if (footprint.pointTracker?.points) {
            for (const [, point] of footprint.pointTracker.points) {
                points.push({
                    x: point.x,
                    y: point.y,
                    confirmations: point.confirmedCount || 1,
                    confidence: point.rating || 0.5,
                    color: point.confirmedCount >= 3 ? 'red' :
                           point.confirmedCount === 2 ? 'orange' : 'blue'
                });
            }
        }

        const data = {
            points: points,
            totalPoints: points.length,
            totalFootprints: 1,
            stats: {
                confirmed3: points.filter(p => p.confirmations >= 3).length,
                confirmed2: points.filter(p => p.confirmations === 2).length,
                confirmed1: points.filter(p => p.confirmations === 1).length
            }
        };

        return this.visualizeAccumulativeModel(data, options);
    }
}

module.exports = ClusterVisualizer;
