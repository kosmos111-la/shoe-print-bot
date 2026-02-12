// modules/footprint/visualizations/cluster-visualizer.js
// 🎨 ТОПОЛОГИЧЕСКАЯ ВИЗУАЛИЗАЦИЯ (С ПОДТВЕРЖДЕНИЯМИ)

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/topology',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,
            debug: options.debug || false,
            showEdges: options.showEdges !== false,
            ...options
        };
       
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
       
        console.log('🎨 ClusterVisualizer создан');
    }

    async visualizeTopologicalModel(topologyData, options = {}) {
        console.log('🎨 Визуализация топологической модели...');
       
        try {
            if (!topologyData || !topologyData.points || topologyData.points.length === 0) {
                return this.createTopologyReport(topologyData, null);
            }
           
            let canvas;
            try {
                canvas = require('canvas');
            } catch (error) {
                return this.createTopologyReport(topologyData, error);
            }
           
            const canvasWidth = options.width || this.config.canvasWidth;
            const canvasHeight = options.height || this.config.canvasHeight;
           
            const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
            const ctx = canvasInstance.getContext('2d');
           
            // Фон
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
           
            // Заголовок
            ctx.fillStyle = '#212529';
            ctx.font = 'bold 26px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`🏗️ ТОПОЛОГИЧЕСКАЯ МОДЕЛЬ`, canvasWidth / 2, 45);
           
            // Вычисляем границы и масштаб
            const validPoints = topologyData.points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
            const { minX, maxX, minY, maxY } = this.calculateBounds(validPoints);
            const scale = this.calculateScale(minX, maxX, minY, maxY, canvasWidth * 0.7, canvasHeight * 0.5);
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight * 0.6;
            const avgX = (minX + maxX) / 2;
            const avgY = (minY + maxY) / 2;
           
            // Рёбра
            if (this.config.showEdges && topologyData.edges) {
                this.drawEdges(ctx, topologyData, avgX, avgY, centerX, centerY, scale);
            }
           
            // 🔥🔥🔥 УЗЛЫ - ПРЯМО ПО confirmationCount!
            this.drawNodes(ctx, topologyData.points, avgX, avgY, centerX, centerY, scale);
           
            // Статистика
            this.drawStats(ctx, topologyData.stats, canvasWidth);
           
            // Легенда
            this.drawLegend(ctx, canvasWidth, canvasHeight);
           
            // Сохраняем
            const filename = options.filename || `topology_${Date.now()}.png`;
            const outputPath = path.join(this.config.outputDir, filename);
           
            return new Promise((resolve, reject) => {
                const out = fs.createWriteStream(outputPath);
                const stream = canvasInstance.createPNGStream();
                stream.pipe(out);
                out.on('finish', () => {
                    console.log(`✅ Визуализация сохранена: ${outputPath}`);
                    resolve({ path: outputPath, stats: topologyData.stats, success: true });
                });
                out.on('error', reject);
            });
           
        } catch (error) {
            console.error('❌ Ошибка визуализации:', error);
            return this.createTopologyReport(topologyData, error);
        }
    }

    // 🔥🔥🔥 РИСОВАНИЕ УЗЛОВ - ПО confirmationCount!
    drawNodes(ctx, points, avgX, avgY, centerX, centerY, scale) {
        const validPoints = points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
       
        // Сортируем: сначала неподтверждённые, потом подтверждённые
        const sortedPoints = [...validPoints].sort((a, b) => {
            const aConf = a.confirmationCount || 0;
            const bConf = b.confirmationCount || 0;
            return aConf - bConf;
        });
       
        let confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;
       
        sortedPoints.forEach(point => {
            const x = centerX + (point.x - avgX) * scale;
            const y = centerY + (point.y - avgY) * scale;
           
            // 🔥🔥🔥 БЕРЁМ ПОДТВЕРЖДЕНИЯ ПРЯМО ИЗ УЗЛА!
            const confirmations = point.confirmationCount || 0;
            const isStructural = point.addedFrom === 'structural_enhancement';
           
            let color, size;
           
            if (confirmations >= 3) {
                color = '#FF0000'; // 🔴 Ядро (3+)
                size = 12;
                confirmed2++;
            } else if (confirmations >= 2) {
                color = '#FFC107'; // 🟡 Подтверждённый (2)
                size = 10;
                confirmed2++;
            } else if (confirmations >= 1) {
                color = '#2196F3'; // 🔵 Новый (1)
                size = 8;
                confirmed1++;
            } else {
                color = '#BDBDBD'; // ⚪ Неподтверждённый (0)
                size = 6;
                confirmed0++;
            }
           
            // Структурные узлы чуть меньше и с обводкой
            if (isStructural) {
                size = size * 0.9;
            }
           
            // Рисуем узел
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
           
            // Обводка
            ctx.strokeStyle = isStructural ? '#000000' : '#FFFFFF';
            ctx.lineWidth = isStructural ? 2 : 1.5;
            ctx.stroke();
           
            // Показываем число подтверждений
            if (confirmations >= 2) {
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
                ctx.fill();
               
                ctx.fillStyle = color;
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(confirmations.toString(), x, y);
            }
           
            // Плюсик для структурных узлов
            if (isStructural) {
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 12px Arial';
                ctx.fillText('+', x, y - size - 5);
            }
        });
       
        console.log(`   🎯 Узлов: 2+=${confirmed2}, 1=${confirmed1}, 0=${confirmed0}`);
    }

    drawEdges(ctx, topologyData, avgX, avgY, centerX, centerY, scale) {
        const pointsMap = new Map();
        topologyData.points.forEach(point => {
            if (point && point.id) pointsMap.set(point.id, point);
        });
       
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
        ctx.lineWidth = 1;
       
        topologyData.edges.forEach(edgeStr => {
            const [nodeAId, nodeBId] = edgeStr.split('--');
            const pointA = pointsMap.get(nodeAId);
            const pointB = pointsMap.get(nodeBId);
           
            if (pointA && pointB) {
                const x1 = centerX + (pointA.x - avgX) * scale;
                const y1 = centerY + (pointA.y - avgY) * scale;
                const x2 = centerX + (pointB.x - avgX) * scale;
                const y2 = centerY + (pointB.y - avgY) * scale;
               
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        });
    }

    drawStats(ctx, stats, canvasWidth) {
        if (!stats) return;
       
        ctx.font = '14px Arial';
        ctx.fillStyle = '#343A40';
        ctx.textAlign = 'left';
       
        const rows = [
            `Узлов: ${stats.totalNodes || 0}`,
            `Рёбер: ${stats.totalEdges || 0}`,
            `🔴 3+: ${stats.confirmed3 || 0}`,
            `🟡 2: ${stats.confirmed2 || 0}`,
            `🔵 1: ${stats.confirmed1 || 0}`,
            `⚪ 0: ${stats.confirmed0 || 0}`
        ];
       
        rows.forEach((text, i) => {
            ctx.fillText(text, 50, 120 + i * 25);
        });
    }

    drawLegend(ctx, canvasWidth, canvasHeight) {
        const legendY = canvasHeight - 100;
        const startX = canvasWidth * 0.1;
       
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(startX - 10, legendY - 20, canvasWidth * 0.8, 90);
        ctx.strokeStyle = '#DEE2E6';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX - 10, legendY - 20, canvasWidth * 0.8, 90);
       
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📋 ЛЕГЕНДА', startX, legendY);
       
        const items = [
            { color: '#FF0000', text: '🔴 Ядро (3+)', y: legendY + 20 },
            { color: '#FFC107', text: '🟡 Подтверждённый (2)', y: legendY + 40 },
            { color: '#2196F3', text: '🔵 Новый (1)', y: legendY + 60 },
            { color: '#000000', text: '+ Структурный узел', y: legendY + 80 }
        ];
       
        items.forEach(item => {
            ctx.fillStyle = item.color;
            ctx.font = '12px Arial';
            ctx.fillText(item.text, startX + 20, item.y);
        });
    }

    calculateBounds(points) {
        const validPoints = points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
        if (validPoints.length === 0) return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
       
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        validPoints.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
       
        const padding = Math.max(maxX - minX, maxY - minY) * 0.1;
        return { minX: minX - padding, maxX: maxX + padding, minY: minY - padding, maxY: maxY + padding };
    }

    calculateScale(minX, maxX, minY, maxY, targetWidth, targetHeight) {
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        return Math.min(targetWidth / width, targetHeight / height, 3);
    }

    createTopologyReport(topologyData, error) {
        const outputPath = path.join(this.config.outputDir, `topology_report_${Date.now()}.txt`);
        let report = `🏗️ ОТЧЕТ О ТОПОЛОГИЧЕСКОЙ МОДЕЛИ\n${'═'.repeat(50)}\n\n`;
       
        if (error) report += `❌ ОШИБКА: ${error.message}\n\n`;
        if (topologyData?.stats) {
            report += `📊 СТАТИСТИКА:\n`;
            report += `• Узлов: ${topologyData.stats.totalNodes}\n`;
            report += `• Рёбер: ${topologyData.stats.totalEdges}\n`;
            report += `• 🔴 3+: ${topologyData.stats.confirmed3}\n`;
            report += `• 🟡 2: ${topologyData.stats.confirmed2}\n`;
            report += `• 🔵 1: ${topologyData.stats.confirmed1}\n`;
            report += `• ⚪ 0: ${topologyData.stats.confirmed0}\n`;
        }
       
        fs.writeFileSync(outputPath, report);
        return { path: outputPath, stats: topologyData?.stats, note: 'Текстовый отчет' };
    }
}

module.exports = ClusterVisualizer;
