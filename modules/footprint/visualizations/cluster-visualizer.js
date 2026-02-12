// modules/footprint/visualizations/cluster-visualizer.js
// 🎨 ТОПОЛОГИЧЕСКАЯ ВИЗУАЛИЗАЦИЯ С ОТРИСОВКОЙ ТРЕУГОЛЬНИКОВ

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/topology',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,
            debug: options.debug || false,
            showTriangles: options.showTriangles !== false,
            showAnchors: options.showAnchors !== false,
            ...options
        };
       
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
       
        console.log('🎨 ClusterVisualizer создан (режим: ОТРИСОВКА ТРЕУГОЛЬНИКОВ)');
    }

    async visualizeTopologicalModel(topologyData, options = {}) {
        console.log('🎨 ВИЗУАЛИЗАЦИЯ ТОПОЛОГИЧЕСКОЙ МОДЕЛИ...');
       
        try {
            if (!topologyData || !topologyData.points || topologyData.points.length === 0) {
                return this.createTopologyReport(topologyData, null);
            }
           
            let canvas;
            try {
                canvas = require('canvas');
            } catch (error) {
                console.log('⚠️ Canvas не доступен, создаю текстовый отчет');
                return this.createTopologyReport(topologyData, error);
            }
           
            const canvasWidth = options.width || this.config.canvasWidth;
            const canvasHeight = options.height || this.config.canvasHeight;
           
            const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
            const ctx = canvasInstance.getContext('2d');
           
            // 1. ФОН
            ctx.fillStyle = '#FFFFFF';
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
                    `🔴 Ядра (4+): ${stats.confirmed4 || stats.core || 0}`,
                    `🟠 Стабильные (3): ${stats.confirmed3 || stats.stable || 0}`,
                    `🟡 Подтверждённые (2): ${stats.confirmed2 || stats.confirmed || 0}`,
                    `🔵 Новые (1): ${stats.confirmed1 || stats.newish || 0}`,
                    `🎯 Триангуляция: ${stats.triangulatedNodes || 0}`
                ];
               
                statRows.forEach((text, index) => {
                    ctx.fillText(text, 50, 120 + index * 25);
                });
            }
           
            // Вычисляем границы и масштаб
            const validPoints = topologyData.points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
            const { minX, maxX, minY, maxY } = this.calculateBounds(validPoints);
            const scale = this.calculateScale(minX, maxX, minY, maxY, canvasWidth * 0.7, canvasHeight * 0.5);
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight * 0.6;
           
            console.log(`📐 Параметры отрисовки:`);
            console.log(`   Границы: x[${minX.toFixed(1)}-${maxX.toFixed(1)}], y[${minY.toFixed(1)}-${maxY.toFixed(1)}]`);
            console.log(`   Масштаб: ${scale.toFixed(3)}`);
            console.log(`   Центр: (${centerX}, ${centerY})`);
           
            // 4. РИСУЕМ РЁБРА
            if (topologyData.edges) {
                this.drawEdges(ctx, topologyData, minX, maxX, minY, maxY, centerX, centerY, scale);
            }
           
            // 5. 🔥🔥🔥 РИСУЕМ ТРЕУГОЛЬНИКИ ДЛЯ ОТЛАДКИ
            if (topologyData.debugTriangles && topologyData.debugTriangles.length > 0) {
                this.drawDebugTriangles(ctx, topologyData.debugTriangles, minX, maxX, minY, maxY, centerX, centerY, scale);
            }
           
            // 6. РИСУЕМ УЗЛЫ
            this.drawNodes(ctx, topologyData.points, minX, maxX, minY, maxY, centerX, centerY, scale);
           
            // 7. ЛЕГЕНДА
            this.drawLegend(ctx, canvasWidth, canvasHeight);
           
            // 8. ИНФОРМАЦИЯ О СИСТЕМЕ
            ctx.fillStyle = '#ADB5BD';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`🏗️ Триангуляция по 3 точкам в модели | ${new Date().toLocaleString('ru-RU')}`,
                        canvasWidth / 2, canvasHeight - 10);
           
            // 9. СОХРАНЯЕМ
            const filename = options.filename || `topology_${Date.now()}.png`;
            const outputPath = path.join(this.config.outputDir, filename);
           
            return new Promise((resolve, reject) => {
                const out = fs.createWriteStream(outputPath);
                const stream = canvasInstance.createPNGStream();
               
                stream.pipe(out);
               
                out.on('finish', () => {
                    console.log(`✅ Визуализация сохранена: ${outputPath}`);
                    resolve({
                        path: outputPath,
                        stats: topologyData.stats,
                        success: true,
                        nodesVisualized: topologyData.points.length
                    });
                });
               
                out.on('error', reject);
            });
           
        } catch (error) {
            console.error('❌ Ошибка визуализации:', error);
            return this.createTopologyReport(topologyData, error);
        }
    }

    // 🔥🔥🔥 ОТРИСОВКА ТРЕУГОЛЬНИКОВ ДЛЯ ОТЛАДКИ
    drawDebugTriangles(ctx, triangles, minX, maxX, minY, maxY, centerX, centerY, scale) {
        if (!triangles || triangles.length === 0) return;
       
        console.log(`🔺 Отрисовка ${triangles.length} отладочных треугольников...`);
       
        const avgX = (minX + maxX) / 2;
        const avgY = (minY + maxY) / 2;
       
        triangles.forEach((triangle, idx) => {
            if (!triangle.anchors || triangle.anchors.length < 3) return;
           
            // Рисуем треугольник в модели (фото 1) - КРАСНЫЙ
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
           
            const p1 = triangle.anchors[0];
            const p2 = triangle.anchors[1];
            const p3 = triangle.anchors[2];
           
            const x1 = centerX + (p1.x - avgX) * scale;
            const y1 = centerY + (p1.y - avgY) * scale;
            const x2 = centerX + (p2.x - avgX) * scale;
            const y2 = centerY + (p2.y - avgY) * scale;
            const x3 = centerX + (p3.x - avgX) * scale;
            const y3 = centerY + (p3.y - avgY) * scale;
           
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.closePath();
            ctx.stroke();
           
            // Рисуем точку в фото 2 - СИНЯЯ
            if (triangle.photo2) {
                ctx.fillStyle = 'rgba(0, 0, 255, 0.8)';
                ctx.beginPath();
                const tx = centerX + (triangle.photo2.x - avgX) * scale;
                const ty = centerY + (triangle.photo2.y - avgY) * scale;
                ctx.arc(tx, ty, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 12px Arial';
                ctx.fillText('Ф2', tx + 15, ty - 15);
            }
           
            // Рисуем восстановленную точку - ФИОЛЕТОВАЯ
            if (triangle.reconstructed) {
                ctx.fillStyle = 'rgba(128, 0, 128, 0.8)';
                ctx.beginPath();
                const rx = centerX + (triangle.reconstructed.x - avgX) * scale;
                const ry = centerY + (triangle.reconstructed.y - avgY) * scale;
                ctx.arc(rx, ry, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 12px Arial';
                ctx.fillText('М', rx + 15, ry - 15);
            }
        });
       
        ctx.setLineDash([]);
    }

    drawEdges(ctx, topologyData, minX, maxX, minY, maxY, centerX, centerY, scale) {
        const pointsMap = new Map();
        topologyData.points.forEach(point => {
            if (point && point.id) {
                pointsMap.set(point.id, point);
            }
        });
       
        const avgX = (minX + maxX) / 2;
        const avgY = (minY + maxY) / 2;
       
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
       
        console.log(`   🔗 Рёбер отрисовано: ${topologyData.edges.length}`);
    }

    drawNodes(ctx, points, minX, maxX, minY, maxY, centerX, centerY, scale) {
        const validPoints = points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
       
        const avgX = (minX + maxX) / 2;
        const avgY = (minY + maxY) / 2;
       
        // Сортируем: сначала обычные узлы, потом структурные (чтобы структурные были сверху)
        const structuralNodes = validPoints.filter(p => p.addedFrom === 'structural_enhancement');
        const originalNodes = validPoints.filter(p => p.addedFrom !== 'structural_enhancement');
       
        console.log(`   🖌 Отрисовка узлов:`);
        console.log(`      Оригинальных: ${originalNodes.length}`);
        console.log(`      Структурных: ${structuralNodes.length}`);
       
        // Рисуем оригинальные узлы
        originalNodes.forEach(point => {
            this.drawNode(ctx, point, avgX, avgY, centerX, centerY, scale, false);
        });
       
        // Рисуем структурные узлы поверх
        structuralNodes.forEach(point => {
            this.drawNode(ctx, point, avgX, avgY, centerX, centerY, scale, true);
        });
    }

    drawNode(ctx, point, avgX, avgY, centerX, centerY, scale, isStructural) {
        const x = centerX + (point.x - avgX) * scale;
        const y = centerY + (point.y - avgY) * scale;
       
        const confirmations = point.confirmationCount || 1;
        let color, size;
       
        if (confirmations >= 4) {
            color = '#FF0000'; // 🔴 Ядро
            size = 12;
        } else if (confirmations >= 3) {
            color = '#FF6B00'; // 🟠 Стабильный
            size = 10;
        } else if (confirmations >= 2) {
            color = '#FFC107'; // 🟡 Подтверждённый
            size = 8;
        } else {
            color = '#2196F3'; // 🔵 Новый
            size = 6;
        }
       
        // Структурные узлы чуть меньше и с обводкой
        if (isStructural) {
            size = size * 0.9;
        }
       
        // Внешний круг
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
       
        // Обводка
        ctx.strokeStyle = isStructural ? '#000000' : '#FFFFFF';
        ctx.lineWidth = isStructural ? 2 : 1.5;
        ctx.stroke();
       
        // Внутренний круг для подтверждений
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
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+', x, y - size - 5);
        }
    }

    drawLegend(ctx, canvasWidth, canvasHeight) {
        const legendY = canvasHeight - 140;
        const startX = canvasWidth * 0.1;
        const columnWidth = canvasWidth * 0.2;
       
        // Фон легенды
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(startX - 10, legendY - 20, canvasWidth * 0.8, 130);
       
        ctx.strokeStyle = '#DEE2E6';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX - 10, legendY - 20, canvasWidth * 0.8, 130);
       
        // Заголовок
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📋 ТОПОЛОГИЧЕСКАЯ ЛЕГЕНДА', startX, legendY);
       
        const legendItems = [
            { color: '#FF0000', text: '🔴 Ядро (4+)', description: '3+ подтверждений, маяк' },
            { color: '#FF6B00', text: '🟠 Стабильный (3)', description: '2 подтверждения' },
            { color: '#FFC107', text: '🟡 Подтверждённый (2)', description: '1 подтверждение' },
            { color: '#2196F3', text: '🔵 Новый (1)', description: 'Только появился' },
            { color: '#800080', text: '🟣 Фото 2', description: 'Исходная позиция' },
            { color: '#FF0000', text: '🔺 Треугольник', description: '3 опорные точки' }
        ];
       
        legendItems.forEach((item, index) => {
            const x = startX + (index % 3) * columnWidth;
            const y = legendY + 25 + Math.floor(index / 3) * 35;
           
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(x + 15, y, 6, 0, Math.PI * 2);
            ctx.fill();
           
            ctx.fillStyle = '#495057';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(item.text, x + 35, y - 2);
           
            ctx.fillStyle = '#6C757D';
            ctx.font = '10px Arial';
            ctx.fillText(item.description, x + 35, y + 15);
        });
       
        // Дополнительная информация
        ctx.fillStyle = '#6C757D';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('➕ Структурный узел (восстановлен по триангуляции)', canvasWidth / 2, legendY + 100);
    }

    calculateBounds(points) {
        const validPoints = points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
       
        if (validPoints.length === 0) {
            return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        }
       
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        validPoints.forEach(point => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
       
        // Добавляем отступы
        const padding = Math.max(maxX - minX, maxY - minY) * 0.1;
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;
       
        return { minX, maxX, minY, maxY };
    }

    calculateScale(minX, maxX, minY, maxY, targetWidth, targetHeight) {
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
       
        const scaleX = targetWidth / width;
        const scaleY = targetHeight / height;
       
        return Math.min(scaleX, scaleY, 3);
    }

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
            report += `• Узлов: ${topologyData.stats?.totalNodes || 0}\n`;
            report += `• Рёбер: ${topologyData.stats?.totalEdges || 0}\n`;
            report += `• Триангуляция: ${topologyData.stats?.triangulatedNodes || 0} узлов\n\n`;
        }
       
        fs.writeFileSync(outputPath, report, 'utf8');
       
        return {
            path: outputPath,
            stats: topologyData?.stats || null,
            note: 'Текстовый отчет'
        };
    }
}

module.exports = ClusterVisualizer;
