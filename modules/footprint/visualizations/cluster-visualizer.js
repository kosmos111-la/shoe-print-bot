// modules/footprint/visualizations/cluster-visualizer.js
// 🔥 ДОБАВЛЕНА АККУМУЛЯТОРНАЯ ВИЗУАЛИЗАЦИЯ

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/clusters',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,
           
            // 🔥 ЦВЕТА ДЛЯ АККУМУЛЯТОРНОЙ МОДЕЛИ
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
           
            // 🔥 НАСТРОЙКИ ДЛЯ АККУМУЛЯТОРА
            accumulativeMode: true,
            showPhotoHistory: true,
           
            ...options
        };
       
        // Создаем директорию
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
       
        console.log('🎨 ClusterVisualizer создан с аккумуляторной визуализацией');
    }
   
    // 🔥 НОВЫЙ МЕТОД: ВИЗУАЛИЗАЦИЯ АККУМУЛЯТОРНОГО СЛЕДА
    async visualizeAccumulativeFootprint(accumulatorData, options = {}) {
        console.log('🎨 Визуализация аккумуляторного следа...');
       
        try {
            // Проверяем доступность canvas
            let canvas;
            try {
                canvas = require('canvas');
            } catch (error) {
                console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
                return this.createAccumulativeTextReport(accumulatorData, options);
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
            ctx.fillText(`🎯 АККУМУЛЯТОРНЫЙ СЛЕД`, canvasWidth / 2, 50);
           
            // 3. ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ
            ctx.font = '18px Arial';
            ctx.fillStyle = '#495057';
            ctx.textAlign = 'center';
            ctx.fillText(`👤 Пользователь: ${accumulatorData.userId || 'unknown'}`, canvasWidth / 2, 85);
           
            // 4. СТАТИСТИКА В ТАБЛИЦЕ
            const stats = accumulatorData.stats || {};
            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = '#343A40';
            ctx.textAlign = 'left';
            ctx.fillText('📊 СТАТИСТИКА ПОДТВЕРЖДЕНИЙ:', 50, 140);
           
            ctx.font = '18px Arial';
            ctx.fillStyle = '#495057';
           
            const statRows = [
                `Всего уникальных точек: ${stats.totalPoints || 0}`,
                `🔴 3+ подтверждений (высокая надежность): ${stats.confirmed3 || 0}`,
                `🟠 2 подтверждения (средняя надежность): ${stats.confirmed2 || 0}`,
                `🔵 1 подтверждение (новая точка): ${stats.confirmed1 || 0}`,
                `📸 Всего фото в истории: ${stats.totalPhotos || 0}`,
                `📅 Создан: ${stats.createdAt ? new Date(stats.createdAt).toLocaleString('ru-RU') : 'неизвестно'}`
            ];
           
            statRows.forEach((text, index) => {
                ctx.fillText(text, 70, 180 + index * 30);
            });
           
            // 5. РИСУЕМ ВСЕ ТОЧКИ ИЗ АККУМУЛЯТОРА
            this.drawAccumulativePoints(ctx, accumulatorData.points || [], canvasWidth, canvasHeight);
           
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
           
            // 7. УЛУЧШЕННАЯ ЛЕГЕНДА ДЛЯ АККУМУЛЯТОРА
            this.drawAccumulativeLegend(ctx, canvasWidth, canvasHeight);
           
            // 8. ИНФОРМАЦИЯ О СИСТЕМЕ
            ctx.fillStyle = '#ADB5BD';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(
                `🎯 Аккумуляционная модель | ${new Date().toLocaleString('ru-RU')}`,
                canvasWidth / 2,
                canvasHeight - 20
            );
           
            // 9. СОХРАНЯЕМ
            const filename = options.filename || `accumulative_${accumulatorData.userId}_${Date.now()}.png`;
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
                        accumulatorId: accumulatorData.id,
                        pointsCount: accumulatorData.points?.length || 0,
                        success: true,
                        accumulative: true
                    });
                });
               
                out.on('error', reject);
            });
           
        } catch (error) {
            console.error('❌ Ошибка визуализации аккумулятора:', error);
            return this.createAccumulativeTextReport(accumulatorData, options);
        }
    }
   
    // 🔥 НОВЫЙ МЕТОД: РИСОВАНИЕ ТОЧЕК ИЗ АККУМУЛЯТОРА
    drawAccumulativePoints(ctx, points, canvasWidth, canvasHeight) {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight * 0.6;
       
        if (points.length === 0) {
            ctx.fillStyle = '#6C757D';
            ctx.font = '20px Arial';
            ctx.fillText('Нет точек для отображения', centerX, centerY);
            return;
        }
       
        // Вычисляем границы для масштабирования
        const { minX, maxX, minY, maxY } = this.calculateBounds(points);
        const scale = this.calculateScale(minX, maxX, minY, maxY, canvasWidth * 0.7, canvasHeight * 0.4);
       
        console.log(`🎨 Рисую ${points.length} точек из аккумулятора`);
       
        // Рисуем каждую точку
        points.forEach(point => {
            const x = centerX + (point.x - (minX + maxX) / 2) * scale;
            const y = centerY + (point.y - (minY + maxY) / 2) * scale;
           
            // Используем цвет и размер из данных
            const color = point.color || this.getAccumulativePointColor(point.confirmations || 1);
            const size = point.size || this.calculateAccumulativePointSize(point.confirmations || 1, point.confidence || 0.5);
           
            // Рисуем внешний круг
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
           
            // Обводка для лучшей видимости
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();
           
            // Внутренний круг для точек с 2+ подтверждениями
            if (point.confirmations >= 2) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
           
            // 🔥 ПОДПИСЬ КОЛИЧЕСТВА ПОДТВЕРЖДЕНИЙ (для точек с 2+)
            if (point.confirmations >= 2) {
                ctx.fillStyle = color;
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(point.confirmations.toString(), x, y);
            }
           
            // 🔥 МАЛЕНЬКИЙ КРУЖОК ДЛЯ НОВЫХ ТОЧЕК
            if (point.isNew && point.confirmations === 1) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
                ctx.fill();
               
                ctx.fillStyle = color;
                ctx.font = 'bold 8px Arial';
                ctx.fillText('N', x, y);
            }
        });
       
        // 🔥 ПОДПИСЬ МАСШТАБА
        ctx.fillStyle = '#6C757D';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`Всего точек: ${points.length}`, canvasWidth - 20, 40);
    }
   
    // 🔥 НОВЫЙ МЕТОД: ЦВЕТ ДЛЯ АККУМУЛЯТОРНОЙ ТОЧКИ
    getAccumulativePointColor(confirmations) {
        if (confirmations >= 3) {
            return this.config.pointColors.confirmed3;
        } else if (confirmations >= 2) {
            return this.config.pointColors.confirmed2;
        } else {
            return this.config.pointColors.confirmed1;
        }
    }
   
    // 🔥 НОВЫЙ МЕТОД: РАЗМЕР ДЛЯ АККУМУЛЯТОРНОЙ ТОЧКИ
    calculateAccumulativePointSize(confirmations, confidence) {
        let baseSize = 4;
       
        // Размер зависит от количества подтверждений
        if (confirmations >= 3) {
            baseSize = 12;
        } else if (confirmations >= 2) {
            baseSize = 8;
        } else {
            baseSize = 6;
        }
       
        // Корректировка по уверенности
        return baseSize + (confidence * 6);
    }
   
    // 🔥 НОВЫЙ МЕТОД: ЛЕГЕНДА ДЛЯ АККУМУЛЯТОРА
    drawAccumulativeLegend(ctx, canvasWidth, canvasHeight) {
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
        ctx.fillText('📋 ЛЕГЕНДА АККУМУЛЯТОРНОЙ МОДЕЛИ', startX, legendY);
       
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
                description: 'Низкая надежность, есть в 1 фото'
            },
            {
                confirmations: 1,
                color: this.config.pointColors.confirmed1,
                text: 'N - новая точка',
                description: 'Добавлена в последнем фото',
                showNew: true
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
           
            // Буква N для новых точек
            if (item.showNew) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x + 15, y + 8, size * 0.3, 0, Math.PI * 2);
                ctx.fill();
               
                ctx.fillStyle = item.color;
                ctx.font = 'bold 8px Arial';
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
   
    // 🔥 НОВЫЙ МЕТОД: ТЕКСТОВЫЙ ОТЧЕТ ДЛЯ АККУМУЛЯТОРА
    createAccumulativeTextReport(accumulatorData, options = {}) {
        const stats = accumulatorData.stats || {};
        const points = accumulatorData.points || [];
       
        const outputDir = options.outputDir || this.config.outputDir;
        const filename = options.filename || `accumulative_report_${accumulatorData.userId}_${Date.now()}.txt`;
        const outputPath = path.join(outputDir, filename);
       
        let report = `🎯 ОТЧЕТ АККУМУЛЯТОРНОГО СЛЕДА\n`;
        report += `═══════════════════════════════════════\n\n`;
       
        report += `👤 ИНФОРМАЦИЯ О ПОЛЬЗОВАТЕЛЕ:\n`;
        report += `├─ ID пользователя: ${accumulatorData.userId || 'unknown'}\n`;
        report += `├─ ID аккумулятора: ${accumulatorData.id || 'unknown'}\n`;
        report += `├─ Название: ${accumulatorData.name || 'Аккумуляторный след'}\n`;
        report += `└─ Тип визуализации: ${accumulatorData.visualizationType || 'accumulative'}\n\n`;
       
        report += `📊 СТАТИСТИКА ПОДТВЕРЖДЕНИЙ:\n`;
        report += `├─ Всего уникальных точек: ${stats.totalPoints || 0}\n`;
        report += `├─ 🔴 3+ подтверждений: ${stats.confirmed3 || 0}\n`;
        report += `├─ 🟠 2 подтверждения: ${stats.confirmed2 || 0}\n`;
        report += `├─ 🔵 1 подтверждение: ${stats.confirmed1 || 0}\n`;
        report += `├─ 📸 Всего фото: ${stats.totalPhotos || 0}\n`;
        report += `├─ 📅 Создан: ${stats.createdAt ? new Date(stats.createdAt).toLocaleString('ru-RU') : 'неизвестно'}\n`;
        report += `└─ 🔄 Последнее обновление: ${stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString('ru-RU') : 'неизвестно'}\n\n`;
       
        report += `🎯 ИНФОРМАЦИЯ О ГЕОМЕТРИЧЕСКОМ СРАВНЕНИИ:\n`;
        if (options.comparisonResult) {
            const comp = options.comparisonResult;
            report += `├─ Сходство: ${(comp.similarity * 100).toFixed(1)}%\n`;
            report += `├─ Решение: ${comp.decision || 'unknown'}\n`;
            report += `├─ Метод: ${comp.method || 'geometric'}\n`;
            report += `└─ Совпадений: ${comp.matches?.length || 0}\n`;
        } else {
            report += `└─ Нет данных о сравнении\n`;
        }
        report += `\n`;
       
        report += `📋 ЛЕГЕНДА ЦВЕТОВ:\n`;
        report += `├─ 🔴 Красный: 3+ подтверждений (высокая надежность)\n`;
        report += `├─ 🟠 Оранжевый: 2 подтверждения (средняя надежность)\n`;
        report += `├─ 🔵 Синий: 1 подтверждение (низкая надежность)\n`;
        report += `└─ N - новая точка (добавлена в последнем фото)\n\n`;
       
        report += `📈 ТОЧКИ С ВЫСОКОЙ НАДЕЖНОСТЬЮ (3+ подтверждений):\n`;
        const highConfidencePoints = points.filter(p => p.confirmations >= 3);
        if (highConfidencePoints.length > 0) {
            highConfidencePoints.slice(0, 10).forEach((point, index) => {
                report += `${index + 1}. ID: ${point.id}, подтверждений: ${point.confirmations}\n`;
            });
            if (highConfidencePoints.length > 10) {
                report += `... и еще ${highConfidencePoints.length - 10} точек\n`;
            }
        } else {
            report += `└─ Нет точек с 3+ подтверждениями\n`;
        }
        report += `\n`;
       
        report += `💡 СИСТЕМА АККУМУЛЯЦИОННОЙ МОДЕЛИ:\n`;
        report += `├─ 1 фото = 1 подтверждение точки\n`;
        report += `├─ Точки накапливаются из всех фото\n`;
        report += `├─ Цвет показывает надежность (количество подтверждений)\n`;
        report += `└─ Геометрическое сравнение для определения схожести\n\n`;
       
        report += `═══════════════════════════════════════\n`;
        report += `Отчет создан: ${new Date().toLocaleString('ru-RU')}\n`;
       
        fs.writeFileSync(outputPath, report, 'utf8');
       
        console.log(`📄 Текстовый отчет сохранен: ${outputPath}`);
       
        return {
            path: outputPath,
            stats: stats,
            pointsCount: points.length,
            note: 'Текстовый отчет аккумуляторного следа'
        };
    }
   
    // 🔥 СУЩЕСТВУЮЩИЕ МЕТОДЫ (для совместимости)
    async visualizeSingleFootprintConfirmations(footprint, options = {}) {
        console.log('🎨 [Совместимость] Визуализация одного следа...');
       
        try {
            // Преобразуем старый формат в аккумуляторный для визуализации
            const points = this.getEnhancedPoints(footprint, options.matchInfo);
            const stats = this.calculateEnhancedConfirmationStats(points, options.matchInfo);
           
            const accumulatorData = {
                userId: footprint.userId || 'unknown',
                id: footprint.id || `fp_${Date.now()}`,
                name: footprint.name || 'След',
                points: points.map(p => ({
                    ...p,
                    confirmations: p.confirmedCount || 1,
                    color: p.color || this.getAccumulativePointColor(p.confirmedCount || 1),
                    size: p.size || this.calculateAccumulativePointSize(p.confirmedCount || 1, p.confidence || 0.5)
                })),
                stats: {
                    totalPoints: points.length,
                    confirmed3: stats.confirmed3 || 0,
                    confirmed2: stats.confirmed2 || 0,
                    confirmed1: stats.confirmed1 || 0,
                    totalPhotos: footprint.metadata?.totalPhotos || 1
                }
            };
           
            return await this.visualizeAccumulativeFootprint(accumulatorData, {
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
