// modules/footprint/visualizations/cluster-visualizer.js
// 🎨 ТОПОЛОГИЧЕСКАЯ ВИЗУАЛИЗАЦИЯ - ЯКОРИ С НОМЕРАМИ

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
       
        console.log('🎨 ClusterVisualizer (диагностический) создан');
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

            // 4. РИСУЕМ РЁБРА (фоном)
            if (this.config.showEdges && topologyData.edges) {
                this.drawEdges(ctx, topologyData, avgX, avgY, centerX, centerY, scale);
            }

            // 5. РИСУЕМ ВСЕ УЗЛЫ (кроме якорей)
            this.drawRegularNodes(ctx, topologyData, avgX, avgY, centerX, centerY, scale);

            // 6. РИСУЕМ ЯКОРИ С НОМЕРАМИ
            if (topologyData.reliableNodeIds && topologyData.reliableNodeIds.length > 0) {
                this.drawAnchors(ctx, topologyData, avgX, avgY, centerX, centerY, scale);
            }

            // 7. ЛЕГЕНДА
            this.drawLegend(ctx, canvasWidth, canvasHeight);

            // 8. ПОДПИСЬ
            ctx.fillStyle = '#ADB5BD';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`🏗️ Якоря с номерами | ${new Date().toLocaleString('ru-RU')}`,
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
                    resolve({ path: outputPath, stats: topologyData.stats, success: true });
                });
                out.on('error', reject);
            });

        } catch (error) {
            console.error('❌ Ошибка визуализации:', error);
            return this.createTopologyReport(topologyData, error);
        }
    }

    // ==================== ОТРИСОВКА ЯКОРЕЙ С НОМЕРАМИ ====================

    drawAnchors(ctx, topologyData, avgX, avgY, centerX, centerY, scale) {
        const points = topologyData.points;
        const reliableIds = new Set(topologyData.reliableNodeIds || []);
       
        // Создаём карту pointId -> индекс для нумерации
        const anchorIndex = new Map();
        let idx = 1;
        for (const point of points) {
            if (reliableIds.has(point.id)) {
                anchorIndex.set(point.id, idx++);
            }
        }
       
        console.log(`   🔴 Отрисовка ${anchorIndex.size} якорей с номерами...`);

        // Формы для разных номеров (для наглядности)
        const shapes = ['circle', 'square', 'triangle'];
       
        for (const point of points) {
            if (!reliableIds.has(point.id)) continue;
           
            const x = centerX + (point.x - avgX) * scale;
            const y = centerY + (point.y - avgY) * scale;
            const number = anchorIndex.get(point.id);
           
            // Выбираем форму по номеру
            const shape = shapes[(number - 1) % shapes.length];
           
            // Размер и цвет зависят от подтверждения
            const confirmations = point.confirmationCount || 1;
            let color, size;
           
            if (confirmations >= 3) {
                color = '#FF0000'; // 🔴 Ядро
                size = 14;
            } else if (confirmations >= 2) {
                color = '#FFC107'; // 🟡 Подтверждённый
                size = 12;
            } else {
                color = '#2196F3'; // 🔵 Новый якорь
                size = 10;
            }
           
            // Рисуем форму
            ctx.fillStyle = color;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
           
            switch(shape) {
                case 'circle':
                    ctx.beginPath();
                    ctx.arc(x, y, size/2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    break;
                case 'square':
                    ctx.fillRect(x - size/2, y - size/2, size, size);
                    ctx.strokeRect(x - size/2, y - size/2, size, size);
                    break;
                case 'triangle':
                    ctx.beginPath();
                    ctx.moveTo(x, y - size/1.5);
                    ctx.lineTo(x + size/1.5, y + size/2);
                    ctx.lineTo(x - size/1.5, y + size/2);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    break;
            }
           
            // Рисуем номер
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(number.toString(), x, y);
        }
    }

    // ==================== ОТРИСОВКА ОБЫЧНЫХ УЗЛОВ ====================

    drawRegularNodes(ctx, topologyData, avgX, avgY, centerX, centerY, scale) {
        const points = topologyData.points;
        const reliableIds = new Set(topologyData.reliableNodeIds || []);
       
        const validPoints = points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number' && !reliableIds.has(p.id));
       
        console.log(`   🖌 Отрисовка ${validPoints.length} обычных узлов...`);

        for (const point of validPoints) {
            const x = centerX + (point.x - avgX) * scale;
            const y = centerY + (point.y - avgY) * scale;

            const confirmations = point.confirmationCount || 0;
           
            let color, size;
           
            if (confirmations >= 2) {
                color = '#FFC107'; // 🟡 Подтверждённый (2+)
                size = 8;
            } else if (confirmations >= 1) {
                color = '#2196F3'; // 🔵 Новый (1)
                size = 6;
            } else {
                color = '#BDBDBD'; // ⚪ Неподтверждённый (0)
                size = 4;
            }

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
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

    drawLegend(ctx, canvasWidth, canvasHeight) {
        const legendY = canvasHeight - 120;
        const startX = canvasWidth * 0.1;
        const columnWidth = canvasWidth * 0.2;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(startX - 10, legendY - 20, canvasWidth * 0.8, 160);
        ctx.strokeStyle = '#DEE2E6';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX - 10, legendY - 20, canvasWidth * 0.8, 160);

        ctx.fillStyle = '#212529';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📋 ТОПОЛОГИЧЕСКАЯ ЛЕГЕНДА', startX, legendY);

        const items = [
            { color: '#FF0000', text: '🔴 Якорь (3+)', desc: 'форма + номер' },
            { color: '#FFC107', text: '🟡 Якорь (2)', desc: 'форма + номер' },
            { color: '#2196F3', text: '🔵 Якорь (1)', desc: 'форма + номер' },
            { color: '#FFC107', text: '🟡 Обычная (2+)', desc: 'круг' },
            { color: '#2196F3', text: '🔵 Обычная (1)', desc: 'круг' },
            { color: '#BDBDBD', text: '⚪ Неподтверждённая', desc: 'круг' }
        ];

        items.forEach((item, index) => {
            const x = startX + (index % 3) * columnWidth;
            const y = legendY + 25 + Math.floor(index / 3) * 35;

            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(x + 15, y + 5, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();

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
            report += `• Якорей: ${topologyData.reliableNodeIds?.length || 0}\n`;
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
