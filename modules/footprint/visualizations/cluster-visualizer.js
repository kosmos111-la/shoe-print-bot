// modules/footprint/visualizations/cluster-visualizer.js
// 🔥 ПРОСТАЯ ВИЗУАЛИЗАЦИЯ АККУМУЛЯТОРА

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/clusters',
            canvasWidth: options.canvasWidth || 1000,
            canvasHeight: options.canvasHeight || 800,
           
            // 🔥 ЦВЕТА ДЛЯ ПРОСТОГО АККУМУЛЯТОРА
            pointColors: {
                confirmed3: '#FF0000',   // 🔴 Красный: 3+ подтверждений
                confirmed2: '#FF6B00',   // 🟠 Оранжевый: 2 подтверждения
                confirmed1: '#2196F3',   // 🔵 Синий: 1 подтверждение
                background: '#F8F9FA'    // Светлый фон
            },
           
            showStats: options.showStats !== false,
            debug: options.debug || false,
           
            ...options
        };
       
        // Создаем директорию
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
       
        console.log('🎨 ClusterVisualizer создан с простой визуализацией аккумулятора');
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: ПРОСТАЯ ВИЗУАЛИЗАЦИЯ АККУМУЛЯТОРА
    async visualizeSimpleAccumulator(accumulatorData, footprint, userId, options = {}) {
        console.log('🎨 Визуализация простого аккумулятора...');
       
        try {
            // Проверяем доступность canvas
            let canvas;
            try {
                canvas = require('canvas');
            } catch (error) {
                console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
                return this.createSimpleAccumulatorTextReport(accumulatorData, options);
            }
           
            // Создаем canvas
            const canvasWidth = options.width || 900;
            const canvasHeight = options.height || 700;
           
            const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
            const ctx = canvasInstance.getContext('2d');
           
            // 1. ФОН
            const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
            gradient.addColorStop(0, '#F8F9FA');
            gradient.addColorStop(1, '#E9ECEF');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
           
            // 2. ЗАГОЛОВОК
            ctx.fillStyle = '#212529';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`👣 АККУМУЛЯЦИОННАЯ МОДЕЛЬ`, canvasWidth / 2, 45);
           
            ctx.font = '16px Arial';
            ctx.fillStyle = '#6C757D';
            ctx.fillText(`Пользователь: ${userId} | Точки: ${accumulatorData.points.length}`,
                        canvasWidth / 2, 75);
           
            // 3. СТАТИСТИКА
            const stats = accumulatorData.stats || {};
            ctx.fillStyle = '#495057';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('📊 СТАТИСТИКА ПОДТВЕРЖДЕНИЙ:', 50, 120);
           
            const statRows = [
                `Всего уникальных геометрических точек: ${stats.totalUniquePoints || 0}`,
                `🔴 3+ подтверждений: ${stats.byConfirmations?.['3+'] || 0}`,
                `🟠 2 подтверждения: ${stats.byConfirmations?.['2'] || 0}`,
                `🔵 1 подтверждение: ${stats.byConfirmations?.['1'] || 0}`,
                `📈 Всего следов: ${accumulatorData.totalFootprints || 1}`,
                `🎯 Алгоритм: простая геометрическая аккумуляция`
            ];
           
            ctx.font = '16px Arial';
            ctx.fillStyle = '#343A40';
            statRows.forEach((text, index) => {
                ctx.fillText(text, 70, 160 + index * 28);
            });
           
            // 4. 🔥 РИСУЕМ ВСЕ ГЕОМЕТРИЧЕСКИЕ ТОЧКИ
            if (accumulatorData.points && accumulatorData.points.length > 0) {
                this.drawSimpleAccumulatorPoints(ctx, accumulatorData.points, canvasWidth, canvasHeight);
            } else {
                ctx.fillStyle = '#6C757D';
                ctx.font = '18px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Нет данных для визуализации', canvasWidth / 2, canvasHeight / 2);
            }
           
            // 5. ПРОСТАЯ ЛЕГЕНДА
            this.drawSimpleLegend(ctx, canvasWidth, canvasHeight);
           
            // 6. ИНФОРМАЦИЯ О СИСТЕМЕ
            ctx.fillStyle = '#ADB5BD';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`🎯 Простая геометрическая аккумуляция | ${new Date().toLocaleString('ru-RU')}`,
                        canvasWidth / 2, canvasHeight - 10);
           
            // 7. СОХРАНЕНИЕ
            const filename = options.filename || `accumulator_${userId}_${Date.now()}.png`;
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
                        success: true,
                        totalPoints: accumulatorData.points?.length || 0
                    });
                });
                out.on('error', reject);
            });
           
        } catch (error) {
            console.error('❌ Ошибка визуализации аккумулятора:', error);
            return { success: false, error: error.message };
        }
    }
   
    // 🔥 ПРОСТОЙ МЕТОД: РИСОВАНИЕ ТОЧЕК АККУМУЛЯТОРА
    drawSimpleAccumulatorPoints(ctx, points, canvasWidth, canvasHeight) {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight * 0.65;
       
        if (points.length === 0) return;
       
        // Вычисляем границы для центрирования
        const xs = points.map(p => p.x || 0);
        const ys = points.map(p => p.y || 0);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
       
        // Масштабирование
        const scaleX = (canvasWidth * 0.6) / width;
        const scaleY = (canvasHeight * 0.4) / height;
        const scale = Math.min(scaleX, scaleY, 2.5);
       
        // Рисуем каждую точку
        points.forEach(point => {
            const x = centerX + (point.x - (minX + maxX) / 2) * scale;
            const y = centerY + (point.y - (minY + maxY) / 2) * scale;
           
            // Цвет и размер
            const color = point.color || this.getPointColorForConfirmations(point.confirmations || 1);
            const size = this.getPointSizeForConfirmations(point.confirmations || 1);
           
            // Внешний круг
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
           
            // Белая обводка
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();
           
            // Для точек с 2+ подтверждениями - внутренний круг
            if (point.confirmations >= 2) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
                ctx.fill();
               
                // Число подтверждений
                ctx.fillStyle = color;
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(point.confirmations.toString(), x, y);
            }
           
            // Для новых точек - буква N
            if (point.isNew && point.confirmations === 1) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
                ctx.fill();
               
                ctx.fillStyle = color;
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('N', x, y);
            }
        });
       
        // Информация
        ctx.fillStyle = '#6C757D';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`Всего точек: ${points.length}`, canvasWidth - 20, 40);
    }
   
    // 🔥 ЦВЕТ ТОЧКИ ПО ПОДТВЕРЖДЕНИЯМ
    getPointColorForConfirmations(confirmations) {
        if (confirmations >= 3) {
            return this.config.pointColors.confirmed3; // 🔴
        } else if (confirmations >= 2) {
            return this.config.pointColors.confirmed2; // 🟠
        } else {
            return this.config.pointColors.confirmed1; // 🔵
        }
    }
   
    // 🔥 РАЗМЕР ТОЧКИ ПО ПОДТВЕРЖДЕНИЯМ
    getPointSizeForConfirmations(confirmations) {
        if (confirmations >= 3) {
            return 10;
        } else if (confirmations >= 2) {
            return 7;
        } else {
            return 5;
        }
    }
   
    // 🔥 ПРОСТАЯ ЛЕГЕНДА
    drawSimpleLegend(ctx, canvasWidth, canvasHeight) {
        const legendY = canvasHeight - 120;
        const startX = 50;
       
        // Фон
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(startX - 10, legendY - 15, 350, 80);
       
        ctx.strokeStyle = '#DEE2E6';
        ctx.lineWidth = 1;
        ctx.strokeRect(startX - 10, legendY - 15, 350, 80);
       
        // Заголовок
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📋 ЛЕГЕНДА:', startX, legendY);
       
        // Элементы
        const legendItems = [
            { confirmations: 3, color: '#FF0000', text: '3+ подтверждений' },
            { confirmations: 2, color: '#FF6B00', text: '2 подтверждения' },
            { confirmations: 1, color: '#2196F3', text: '1 подтверждение' },
            { confirmations: 1, color: '#2196F3', text: 'N - новая точка' }
        ];
       
        legendItems.forEach((item, index) => {
            const y = legendY + 20 + index * 18;
           
            // Точка-пример
            const size = this.getPointSizeForConfirmations(item.confirmations);
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(startX + 5, y + 5, size, 0, Math.PI * 2);
            ctx.fill();
           
            // Обводка
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();
           
            // Буква N для новых
            if (index === 3) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(startX + 5, y + 5, size * 0.3, 0, Math.PI * 2);
                ctx.fill();
               
                ctx.fillStyle = item.color;
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('N', startX + 5, y + 5);
            }
           
            // Текст
            ctx.fillStyle = '#495057';
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(item.text, startX + 25, y + 8);
        });
    }
   
    // 🔥 ТЕКСТОВЫЙ ОТЧЕТ АККУМУЛЯТОРА
    createSimpleAccumulatorTextReport(accumulatorData, options = {}) {
        const stats = accumulatorData.stats || {};
        const points = accumulatorData.points || [];
       
        const outputDir = options.outputDir || this.config.outputDir;
        const filename = options.filename || `accumulator_report_${Date.now()}.txt`;
        const outputPath = path.join(outputDir, filename);
       
        let report = `🎯 ОТЧЕТ АККУМУЛЯЦИОННОЙ МОДЕЛИ\n`;
        report += `══════════════════════════════════════\n\n`;
       
        report += `👤 ПОЛЬЗОВАТЕЛЬ: ${accumulatorData.userId || 'unknown'}\n`;
        report += `📅 СОЗДАН: ${accumulatorData.stats?.createdAt || new Date().toLocaleString('ru-RU')}\n`;
        report += `🎯 АЛГОРИТМ: Простая геометрическая аккумуляция\n\n`;
       
        report += `📊 СТАТИСТИКА:\n`;
        report += `├─ Всего уникальных точек: ${stats.totalUniquePoints || 0}\n`;
        report += `├─ 🔴 3+ подтверждений: ${stats.byConfirmations?.['3+'] || 0}\n`;
        report += `├─ 🟠 2 подтверждения: ${stats.byConfirmations?.['2'] || 0}\n`;
        report += `├─ 🔵 1 подтверждение: ${stats.byConfirmations?.['1'] || 0}\n`;
        report += `└─ 📈 Всего следов: ${accumulatorData.totalFootprints || 1}\n\n`;
       
        report += `📋 ТОЧКИ С ВЫСОКОЙ НАДЕЖНОСТЬЮ (3+ подтверждений):\n`;
        const highConfidence = points.filter(p => p.confirmations >= 3);
        if (highConfidence.length > 0) {
            highConfidence.slice(0, 10).forEach((point, index) => {
                const shortHash = point.geometricHash ? point.geometricHash.substring(0, 8) : point.id;
                report += `${index + 1}. ${shortHash} - ${point.confirmations} подтверждений\n`;
            });
            if (highConfidence.length > 10) {
                report += `... и еще ${highConfidence.length - 10} точек\n`;
            }
        } else {
            report += `└─ Нет точек с 3+ подтверждениями\n`;
        }
        report += `\n`;
       
        report += `⚡ СИСТЕМА:\n`;
        report += `├─ Каждая точка = геометрический хеш\n`;
        report += `├─ Накопление из всех следов\n`;
        report += `├─ Цвет по подтверждениям\n`;
        report += `└─ Простая аккумуляция, без трансформаций\n\n`;
       
        report += `══════════════════════════════════════\n`;
        report += `Отчет создан: ${new Date().toLocaleString('ru-RU')}\n`;
       
        fs.writeFileSync(outputPath, report, 'utf8');
       
        console.log(`📄 Текстовый отчет аккумулятора сохранен: ${outputPath}`);
       
        return {
            path: outputPath,
            stats: stats,
            pointsCount: points.length
        };
    }
   
    // 🔥 СТАРЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ
    async visualizeAccumulativeModel(accumulativeData, footprint, options = {}) {
        console.log('🎨 [Совместимость] Визуализация аккумуляционной модели...');
        return this.visualizeSimpleAccumulator(accumulativeData, footprint, accumulativeData.userId, options);
    }
   
    async visualizeSingleFootprintConfirmations(footprint, options = {}) {
        console.log('🎨 [Совместимость] Визуализация одного следа...');
       
        try {
            // Преобразуем старый формат
            const points = this.getEnhancedPoints(footprint, options.matchInfo);
            const stats = this.calculateEnhancedConfirmationStats(points, options.matchInfo);
           
            const accumulatorData = {
                userId: footprint.userId || 'unknown',
                stats: {
                    totalUniquePoints: points.length,
                    byConfirmations: {
                        '3+': stats.confirmed3 || 0,
                        '2': stats.confirmed2 || 0,
                        '1': stats.confirmed1 || 0
                    }
                },
                points: points.map(p => ({
                    id: p.id,
                    x: p.x,
                    y: p.y,
                    confirmations: p.confirmedCount || 1,
                    isNew: (p.confirmedCount || 1) === 1
                })),
                totalFootprints: 1
            };
           
            return await this.visualizeSimpleAccumulator(
                accumulatorData,
                footprint,
                footprint.userId || 'unknown',
                options
            );
           
        } catch (error) {
            console.log('⚠️ Ошибка совместимой визуализации:', error.message);
            return null;
        }
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
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
        let confirmed3 = 0, confirmed2 = 0, confirmed1 = 0;
       
        points.forEach(point => {
            const confirmations = point.confirmedCount || 0;
            if (confirmations >= 3) {
                confirmed3++;
            } else if (confirmations >= 2) {
                confirmed2++;
            } else if (confirmations >= 1) {
                confirmed1++;
            }
        });
       
        return { confirmed3, confirmed2, confirmed1, total: points.length };
    }
   
    // 🔥 ДРУГИЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ
    async visualizeComparison(footprint1, footprint2, options = {}) {
        console.log('🎨 [Совместимость] Визуализация сравнения...');
        return { success: true, path: null, note: 'Используйте аккумуляторную модель' };
    }
   
    async visualizeTwoFootprintComparison(footprint1, footprint2, options = {}) {
        return this.visualizeComparison(footprint1, footprint2, options);
    }
   
    async visualizeAccumulativeFootprint(accumulatorData, options = {}) {
        return this.visualizeSimpleAccumulator(
            accumulatorData,
            { id: accumulatorData.id, name: accumulatorData.name },
            accumulatorData.userId,
            options
        );
    }
}

module.exports = ClusterVisualizer;
