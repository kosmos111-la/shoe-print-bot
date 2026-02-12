// modules/footprint/visualizations/cluster-visualizer.js
// 🔥 ТОПОЛОГИЧЕСКАЯ ВИЗУАЛИЗАЦИЯ

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/topology',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,
           
            // 🔥 ЦВЕТА ДЛЯ ТОПОЛОГИЧЕСКОЙ ВИЗУАЛИЗАЦИИ
            pointColors: {
                confirmed3: '#FF0000',   // 🔴 Красный: 3+ подтверждений (ядра)
                confirmed2: '#FF6B00',   // 🟠 Оранжевый: 2 подтверждения
                confirmed1: '#2196F3',   // 🔵 Синий: 1 подтверждение
                confirmed0: '#BDBDBD',   // ⚪ Серый: новые узлы
                edgeColor: 'rgba(100, 100, 100, 0.3)', // Цвет рёбер
                background: '#FFFFFF'
            },
           
            legendPosition: options.legendPosition || 'bottom',
            showStats: options.showStats !== false,
            debug: options.debug || false,
            showEdges: options.showEdges !== false, // 🔥 ПОКАЗЫВАТЬ РЁБРА
            ...options
        };
       
        // Создаем директорию
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
       
        console.log('🎨 Топологический ClusterVisualizer создан');
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: Визуализация топологической модели
    async visualizeTopologicalModel(topologyData, options = {}) {
        console.log('🎨 Визуализация топологической модели...');
       
        try {
            if (!topologyData || !topologyData.points || topologyData.points.length === 0) {
                console.log('⚠️ Нет данных для визуализации');
                return this.createTopologyReport(topologyData, null);
            }
           
            // Проверяем доступность canvas
            let canvas;
            try {
                canvas = require('canvas');
            } catch (error) {
                console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
                return this.createTopologyReport(topologyData, null);
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
            ctx.font = 'bold 26px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`🏗️ ТОПОЛОГИЧЕСКАЯ МОДЕЛЬ`, canvasWidth / 2, 45);
           
            if (topologyData.modelName) {
                ctx.font = '18px Arial';
                ctx.fillStyle = '#495057';
                ctx.fillText(topologyData.modelName, canvasWidth / 2, 75);
            }
           
            // 3. СТАТИСТИКА
            if (topologyData.stats) {
                ctx.font = '16px Arial';
                ctx.fillStyle = '#343A40';
                ctx.textAlign = 'left';
               
                const stats = topologyData.stats;
                const statRows = [
                    `Узлов: ${stats.totalNodes}`,
                    `Рёбер: ${stats.totalEdges || 0}`,
                    `Средняя степень: ${stats.avgDegree?.toFixed(2) || '?'}`,
                    `🔴 3+ подтверждений: ${stats.confirmed3}`,
                    `🟠 2 подтверждения: ${stats.confirmed2}`,
                    `🔵 1 подтверждение: ${stats.confirmed1}`,
                    `⚪ Новые узлы: ${stats.confirmed0}`
                ];
               
                statRows.forEach((text, index) => {
                    ctx.fillText(text, 50, 120 + index * 25);
                });
            }
           
            // 4. РИСУЕМ РЁБРА (если есть и включено)
            if (this.config.showEdges && topologyData.edges && topologyData.edges.length > 0) {
                this.drawTopologyEdges(ctx, topologyData, canvasWidth, canvasHeight);
            }
           
            // 5. РИСУЕМ УЗЛЫ
            this.drawTopologyNodes(ctx, topologyData, canvasWidth, canvasHeight);
           
            // 6. ЛЕГЕНДА
            this.drawTopologyLegend(ctx, canvasWidth, canvasHeight);
           
            // 7. ИНФОРМАЦИЯ О СИСТЕМЕ
            ctx.fillStyle = '#ADB5BD';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`🏗️ Триангуляция Делоне | Weisfeiler-Lehman | ${new Date().toLocaleString('ru-RU')}`,
                        canvasWidth / 2, canvasHeight - 10);
           
            // 8. СОХРАНЯЕМ
            const filename = options.filename || `topology_${Date.now()}.png`;
            const outputPath = path.join(this.config.outputDir, filename);
           
            return new Promise((resolve, reject) => {
                const out = fs.createWriteStream(outputPath);
                const stream = canvasInstance.createPNGStream();
               
                stream.pipe(out);
               
                out.on('finish', () => {
                    console.log(`✅ Топологическая визуализация сохранена: ${outputPath}`);
                    resolve({
                        path: outputPath,
                        stats: topologyData.stats,
                        success: true,
                        topological: true
                    });
                });
               
                out.on('error', reject);
            });
           
        } catch (error) {
            console.error('❌ Ошибка визуализации топологии:', error);
            return this.createTopologyReport(topologyData, error);
        }
    }
   
    // 🔥 РИСОВАНИЕ РЁБЕР ТОПОЛОГИЧЕСКОГО ГРАФА
    drawTopologyEdges(ctx, topologyData, canvasWidth, canvasHeight) {
        const pointsMap = new Map();
        topologyData.points.forEach(point => {
            pointsMap.set(point.id, point);
        });
       
        const { minX, maxX, minY, maxY } = this.calculateBounds(topologyData.points);
        const scale = this.calculateScale(minX, maxX, minY, maxY, canvasWidth * 0.7, canvasHeight * 0.5);
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight * 0.6;
       
        ctx.strokeStyle = this.config.pointColors.edgeColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
       
        topologyData.edges.forEach(edgeStr => {
            const [nodeAId, nodeBId] = edgeStr.split('--');
            const pointA = pointsMap.get(nodeAId);
            const pointB = pointsMap.get(nodeBId);
           
            if (pointA && pointB) {
                const x1 = centerX + (pointA.x - (minX + maxX) / 2) * scale;
                const y1 = centerY + (pointA.y - (minY + maxY) / 2) * scale;
                const x2 = centerX + (pointB.x - (minX + maxX) / 2) * scale;
                const y2 = centerY + (pointB.y - (minY + maxY) / 2) * scale;
               
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        });
       
        ctx.globalAlpha = 1.0;
    }
   
    // 🔥 РИСОВАНИЕ УЗЛОВ ТОПОЛОГИЧЕСКОГО ГРАФА
    drawTopologyNodes(ctx, topologyData, canvasWidth, canvasHeight) {
        const points = topologyData.points;
        if (points.length === 0) return;
       
        const { minX, maxX, minY, maxY } = this.calculateBounds(points);
        const scale = this.calculateScale(minX, maxX, minY, maxY, canvasWidth * 0.7, canvasHeight * 0.5);
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight * 0.6;
       
        // Сначала рисуем узлы с меньшим количеством подтверждений (чтобы они были под узлами с большим)
        const sortedPoints = [...points].sort((a, b) => {
            const aConf = a.vizData?.confirmations || 0;
            const bConf = b.vizData?.confirmations || 0;
            return aConf - bConf;
        });
       
        sortedPoints.forEach(point => {
            const x = centerX + (point.x - (minX + maxX) / 2) * scale;
            const y = centerY + (point.y - (minY + maxY) / 2) * scale;
           
            const vizData = point.vizData || {};
            const color = vizData.color || this.config.pointColors.confirmed0;
            const size = vizData.size || 6;
            const confirmations = point.confirmationCount || 0;
           
            // Внешний круг
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
           
            // Обводка
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();
           
            // Внутренний круг для узлов с подтверждениями
            if (confirmations >= 2) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
                ctx.fill();
               
                // Число подтверждений
                ctx.fillStyle = color;
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(confirmations.toString(), x, y);
            }
           
            // Для отладки: подписи узлов
            if (this.config.debug && confirmations >= 3) {
                ctx.fillStyle = '#000000';
                ctx.font = '8px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(point.id.substring(0, 6), x, y + size + 10);
            }
        });
    }
   
    // 🔥 ЛЕГЕНДА ДЛЯ ТОПОЛОГИЧЕСКОЙ ВИЗУАЛИЗАЦИИ
    drawTopologyLegend(ctx, canvasWidth, canvasHeight) {
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
        ctx.fillText('📋 ТОПОЛОГИЧЕСКАЯ ЛЕГЕНДА', startX, legendY);
       
        // Элементы легенды
        const legendItems = [
            {
                confirmations: 3,
                color: this.config.pointColors.confirmed3,
                text: '3+ подтверждений',
                description: 'Ядра модели'
            },
            {
                confirmations: 2,
                color: this.config.pointColors.confirmed2,
                text: '2 подтверждения',
                description: 'Стабильные узлы'
            },
            {
                confirmations: 1,
                color: this.config.pointColors.confirmed1,
                text: '1 подтверждение',
                description: 'Новые узлы'
            },
            {
                confirmations: 0,
                color: this.config.pointColors.confirmed0,
                text: '0 подтверждений',
                description: 'Предсказанные'
            }
        ];
       
        legendItems.forEach((item, index) => {
            const x = startX + (index % 3) * columnWidth;
            const y = legendY + 20 + Math.floor(index / 3) * 35;
           
            // Рисуем пример точки
            const size = item.confirmations >= 3 ? 8 : item.confirmations >= 2 ? 6 : 4;
           
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
   
    // 🔥 ТЕКСТОВЫЙ ОТЧЕТ О ТОПОЛОГИЧЕСКОЙ МОДЕЛИ
    createTopologyReport(topologyData, error = null) {
        const outputPath = path.join(this.config.outputDir, `topology_report_${Date.now()}.txt`);
       
        let report = `🏗️ ОТЧЕТ О ТОПОЛОГИЧЕСКОЙ МОДЕЛИ\n`;
        report += `═`.repeat(50) + `\n\n`;
       
        if (error) {
            report += `❌ ОШИБКА: ${error.message}\n\n`;
        }
       
        if (topologyData) {
            report += `📋 ИНФОРМАЦИЯ О МОДЕЛИ:\n`;
            report += `• Название: ${topologyData.modelName || 'Неизвестная'}\n`;
            report += `• ID: ${topologyData.modelId?.slice(0, 8) || 'N/A'}\n`;
            report += `• Метод визуализации: ${topologyData.visualizationMethod || 'topological'}\n`;
            report += `• Время создания: ${new Date().toLocaleString('ru-RU')}\n\n`;
           
            if (topologyData.stats) {
                const stats = topologyData.stats;
                report += `📊 СТАТИСТИКА МОДЕЛИ:\n`;
                report += `• Всего узлов: ${stats.totalNodes}\n`;
                report += `• Всего рёбер: ${stats.totalEdges || 0}\n`;
                report += `• Средняя степень: ${stats.avgDegree?.toFixed(2) || '?'}\n`;
                report += `• Уникальность подписей: ${stats.uniquenessRatio ? (stats.uniquenessRatio * 100).toFixed(1) + '%' : '?'}\n\n`;
               
                report += `🎯 РАСПРЕДЕЛЕНИЕ ПОДТВЕРЖДЕНИЙ:\n`;
                report += `• 🔴 3+ подтверждений: ${stats.confirmed3} (ядра модели)\n`;
                report += `• 🟠 2 подтверждения: ${stats.confirmed2} (стабильные узлы)\n`;
                report += `• 🔵 1 подтверждение: ${stats.confirmed1} (новые узлы)\n`;
                report += `• ⚪ 0 подтверждений: ${stats.confirmed0} (предсказанные)\n\n`;
            }
           
            if (topologyData.metadata) {
                report += `📜 МЕТАДАННЫЕ:\n`;
                Object.entries(topologyData.metadata).forEach(([key, value]) => {
                    if (typeof value === 'string' || typeof value === 'number') {
                        report += `• ${key}: ${value}\n`;
                    }
                });
                report += `\n`;
            }
        } else {
            report += `⚠️ Нет данных топологической модели\n\n`;
        }
       
        report += `🏗️ МЕТОДОЛОГИЯ:\n`;
        report += `• Триангуляция Делоне: построение графа из точек\n`;
        report += `• Weisfeiler-Lehman: инвариантные подписи узлов\n`;
        report += `• Аккумулятивная модель: объединение узлов из всех следов\n`;
        report += `• Цветовая схема: по количеству подтверждений\n\n`;
       
        report += `═`.repeat(50) + `\n`;
        report += `Отчет создан: ${new Date().toLocaleString('ru-RU')}\n`;
       
        fs.writeFileSync(outputPath, report, 'utf8');
       
        return {
            path: outputPath,
            stats: topologyData?.stats || null,
            note: 'Текстовый отчет топологической модели',
            error: error?.message
        };
    }
   
    // 🔥 СОВМЕСТИМОСТЬ СО СТАРЫМ КОДОМ
    async visualizeSingleFootprintConfirmations(footprint, options = {}) {
        console.log('🎨 [Совместимость] Визуализация через старый метод');
       
        // Если переданы топологические данные - используем новую визуализацию
        if (options.topologyData) {
            return await this.visualizeTopologicalModel(options.topologyData, options);
        }
       
        // Иначе используем старый метод
        return await this.legacyVisualization(footprint, options);
    }
   
    // Старый метод визуализации (для совместимости)
    async legacyVisualization(footprint, options = {}) {
        // ... старый код визуализации ...
        console.log('⚠️ Использую старый метод визуализации');
        return { success: false, note: 'Используйте топологическую визуализацию' };
    }
}

module.exports = ClusterVisualizer;
