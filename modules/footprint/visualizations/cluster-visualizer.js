// modules/footprint/visualizations/cluster-visualizer.js
// 🎨 ТОПОЛОГИЧЕСКАЯ ВИЗУАЛИЗАЦИЯ - РИСУЕМ ВСЕ ТОЧКИ И ТРЕУГОЛЬНИКИ!

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
            showTriangles: options.showTriangles !== false,
            ...options
        };
       
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
       
        console.log('🎨 ClusterVisualizer создан (с поддержкой треугольников)');
    }

    async visualizeTopologicalModel(topologyData, options = {}) {
        console.log('🎨 Визуализация топологической модели...');
       
        try {
            if (!topologyData || !topologyData.points || topologyData.points.length === 0) {
                console.log('⚠️ Нет данных для визуализации');
                return this.createTopologyReport(topologyData, null);
            }

            console.log(`📊 Всего точек в модели: ${topologyData.points.length}`);

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

            // 3. Вычисляем границы и масштаб
            const validPoints = topologyData.points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
            console.log(`📐 Точки с координатами: ${validPoints.length}/${topologyData.points.length}`);
           
            const { minX, maxX, minY, maxY } = this.calculateBounds(validPoints);
            const scale = this.calculateScale(minX, maxX, minY, maxY, canvasWidth * 0.7, canvasHeight * 0.5);
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight * 0.6;
            const avgX = (minX + maxX) / 2;
            const avgY = (minY + maxY) / 2;

            console.log(`📐 Параметры отрисовки:`);
            console.log(`   Границы: x[${minX.toFixed(1)}-${maxX.toFixed(1)}], y[${minY.toFixed(1)}-${maxY.toFixed(1)}]`);
            console.log(`   Масштаб: ${scale.toFixed(3)}`);
            console.log(`   Центр: (${centerX}, ${centerY})`);

            // 4. РИСУЕМ ТРЕУГОЛЬНИКИ (поверх рёбер, но под точками)
            if (this.config.showTriangles && topologyData.triangles) {
                this.drawTriangles(ctx, topologyData, avgX, avgY, centerX, centerY, scale);
            }

            // 5. РИСУЕМ РЁБРА
            if (this.config.showEdges && topologyData.edges) {
                this.drawEdges(ctx, topologyData, avgX, avgY, centerX, centerY, scale);
            }

            // 6. 🔥🔥🔥 РИСУЕМ ВСЕ УЗЛЫ
            this.drawNodes(ctx, topologyData.points, avgX, avgY, centerX, centerY, scale);

            // 7. СТАТИСТИКА
            this.drawStats(ctx, topologyData.stats, canvasWidth);

            // 8. ЛЕГЕНДА
            this.drawLegend(ctx, canvasWidth, canvasHeight);

            // 9. ПОДПИСЬ
            ctx.fillStyle = '#ADB5BD';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`🏗️ Триангуляция Делоне | Weisfeiler-Lehman | Треугольники салатовые | ${new Date().toLocaleString('ru-RU')}`,
                        canvasWidth / 2, canvasHeight - 10);

            // 10. СОХРАНЯЕМ
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

    // 🔥 НОВЫЙ МЕТОД: РИСОВАНИЕ ТРЕУГОЛЬНИКОВ
    drawTriangles(ctx, topologyData, avgX, avgY, centerX, centerY, scale) {
        if (!topologyData.triangles || topologyData.triangles.length === 0) return;
       
        const pointsMap = new Map();
        topologyData.points.forEach(point => {
            if (point && point.id) pointsMap.set(point.id, point);
        });

        ctx.strokeStyle = '#90EE90'; // салатовый
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]); // пунктир для отличия от обычных рёбер
        let trianglesDrawn = 0;

        topologyData.triangles.forEach(triangle => {
            const [idA, idB, idC] = triangle;
            const pointA = pointsMap.get(idA);
            const pointB = pointsMap.get(idB);
            const pointC = pointsMap.get(idC);

            if (pointA && pointB && pointC) {
                const x1 = centerX + (pointA.x - avgX) * scale;
                const y1 = centerY + (pointA.y - avgY) * scale;
                const x2 = centerX + (pointB.x - avgX) * scale;
                const y2 = centerY + (pointB.y - avgY) * scale;
                const x3 = centerX + (pointC.x - avgX) * scale;
                const y3 = centerY + (pointC.y - avgY) * scale;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineTo(x3, y3);
                ctx.closePath();
                ctx.stroke();
                trianglesDrawn++;
            }
        });

        ctx.setLineDash([]); // сброс пунктира
        console.log(`   🔺 Треугольников отрисовано: ${trianglesDrawn}`);
    }

    drawNodes(ctx, points, avgX, avgY, centerX, centerY, scale) {
        const validPoints = points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
       
        console.log(`   🖌 Отрисовка ${validPoints.length} узлов...`);

        const sortedPoints = [...validPoints].sort((a, b) => {
            const aConf = a.confirmationCount || 0;
            const bConf = b.confirmationCount || 0;
            return aConf - bConf;
        });

        let confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;

        sortedPoints.forEach(point => {
            const x = centerX + (point.x - avgX) * scale;
            const y = centerY + (point.y - avgY) * scale;

            const confirmations = point.confirmationCount || 0;
            const isStructural = point.addedFrom === 'structural_enhancement';
            const isNewStructural = isStructural && confirmations === 1;

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

            if (isStructural) {
                size = size * 0.9;
            }

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = isStructural ? '#000000' : '#FFFFFF';
            ctx.lineWidth = isStructural ? 2 : 1.5;
            ctx.stroke();

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

            if (isNewStructural) {
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('+', x, y - size - 5);
            }
        });

        console.log(`   🎯 Узлов: 2+=${confirmed2}, 1=${confirmed1}, 0=${confirmed0}`);
        console.log(`   ✅ Отрисовано: ${validPoints.length} узлов`);
    }

    drawEdges(ctx, topologyData, avgX, avgY, centerX, centerY, scale) {
        const pointsMap = new Map();
        topologyData.points.forEach(point => {
            if (point && point.id) pointsMap.set(point.id, point);
        });

        ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
        ctx.lineWidth = 1;
        let edgesDrawn = 0;

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
                edgesDrawn++;
            }
        });

        console.log(`   🔗 Рёбер отрисовано: ${edgesDrawn}`);
    }

    drawStats(ctx, stats, canvasWidth) {
        if (!stats) return;

        ctx.font = '14px Arial';
        ctx.fillStyle = '#343A40';
        ctx.textAlign = 'left';

        const rows = [
            `Узлов: ${stats.totalNodes || 0}`,
            `Рёбер: ${stats.totalEdges || 0}`,
            `Средняя степень: ${stats.avgDegree?.toFixed(2) || '?'}`,
            `🔴 3+: ${stats.confirmed3 || 0}`,
            `🟡 2: ${stats.confirmed2 || 0}`,
            `🔵 1: ${stats.confirmed1 || 0}`,
            `⚪ 0: ${stats.confirmed0 || 0}`,
            `🔺 Треугольников: ${stats.triangles || 0}`
        ];

        rows.forEach((text, i) => {
            ctx.fillText(text, 50, 120 + i * 25);
        });
    }

    drawLegend(ctx, canvasWidth, canvasHeight) {
        const legendY = canvasHeight - 120;
        const startX = canvasWidth * 0.1;
        const columnWidth = canvasWidth * 0.2;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(startX - 10, legendY - 20, canvasWidth * 0.8, 140);
        ctx.strokeStyle = '#DEE2E6';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX - 10, legendY - 20, canvasWidth * 0.8, 140);

        ctx.fillStyle = '#212529';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📋 ТОПОЛОГИЧЕСКАЯ ЛЕГЕНДА', startX, legendY);

        const items = [
            { color: '#FF0000', text: '🔴 Ядро (3+)', desc: '3+ подтверждения' },
            { color: '#FFC107', text: '🟡 Подтверждённый (2)', desc: '2 подтверждения' },
            { color: '#2196F3', text: '🔵 Новый (1)', desc: '1 подтверждение' },
            { color: '#BDBDBD', text: '⚪ Неподтверждённый (0)', desc: '0 подтверждений' },
            { color: '#000000', text: '➕ Новая структурная точка', desc: 'добавлена из фото 2' },
            { color: '#90EE90', text: '🔺 Треугольники', desc: 'проверка формы (салатовый)' }
        ];

        items.forEach((item, index) => {
            const x = startX + (index % 3) * columnWidth;
            const y = legendY + 25 + Math.floor(index / 3) * 35;

            if (item.color === '#90EE90') {
                ctx.strokeStyle = '#90EE90';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 3]);
                ctx.beginPath();
                ctx.moveTo(x, y - 5);
                ctx.lineTo(x + 20, y - 5);
                ctx.lineTo(x + 10, y - 15);
                ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.arc(x + 15, y + 5, 6, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = item.color === '#000000' ? '#000000' : '#FFFFFF';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            ctx.fillStyle = '#495057';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(item.text, x + 35, y);
           
            ctx.fillStyle = '#6C757D';
            ctx.font = '10px Arial';
            ctx.fillText(item.desc, x + 35, y + 18);
        });
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

        const padding = Math.max(maxX - minX, maxY - minY) * 0.1;
        return {
            minX: minX - padding,
            maxX: maxX + padding,
            minY: minY - padding,
            maxY: maxY + padding
        };
    }

    calculateScale(minX, maxX, minY, maxY, targetWidth, targetHeight) {
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        return Math.min(targetWidth / width, targetHeight / height, 3);
    }

    createTopologyReport(topologyData, error) {
        const outputPath = path.join(this.config.outputDir, `topology_report_${Date.now()}.txt`);
       
        let report = `🏗️ ОТЧЕТ О ТОПОЛОГИЧЕСКОЙ МОДЕЛИ\n`;
        report += `═`.repeat(50) + `\n\n`;
       
        if (error) report += `❌ ОШИБКА: ${error.message}\n\n`;
       
        if (topologyData) {
            report += `📋 ИНФОРМАЦИЯ О МОДЕЛИ:\n`;
            report += `• Название: ${topologyData.modelName || 'Неизвестная'}\n`;
            report += `• Узлов: ${topologyData.stats?.totalNodes || 0}\n`;
            report += `• Рёбер: ${topologyData.stats?.totalEdges || 0}\n`;
            report += `• Треугольников: ${topologyData.stats?.triangles || 0}\n`;
            report += `• 🟡 2 подтверждения: ${topologyData.stats?.confirmed2 || 0}\n`;
            report += `• 🔵 1 подтверждение: ${topologyData.stats?.confirmed1 || 0}\n`;
            report += `• ⚪ 0 подтверждений: ${topologyData.stats?.confirmed0 || 0}\n`;
        }
       
        fs.writeFileSync(outputPath, report, 'utf8');
       
        return {
            path: outputPath,
            stats: topologyData?.stats,
            note: 'Текстовый отчет'
        };
    }
}

module.exports = ClusterVisualizer;
