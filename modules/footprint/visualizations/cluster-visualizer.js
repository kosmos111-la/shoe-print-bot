// modules/footprint/visualizations/cluster-visualizer.js
// 🔥 ТОПОЛОГИЧЕСКАЯ ВИЗУАЛИЗАЦИЯ (ИСПРАВЛЕННАЯ - ПОКАЗЫВАЕТ ВСЕ УЗЛЫ!)

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/topology',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,
         
            // 🔥 ЦВЕТА ПО КОЛИЧЕСТВУ ПОДТВЕРЖДЕНИЙ
            pointColors: {
                core: '#FF0000',     // 🔴 4+ подтверждений (ядра)
                stable: '#FF6B00',   // 🟠 3 подтверждения (стабильные)
                confirmed: '#FFC107', // 🟡 2 подтверждения (подтверждённые)
                newish: '#2196F3',   // 🔵 1 подтверждение (новые)
                fading: '#BDBDBD',   // ⚪ 0 подтверждений (затухающие)
                structural: '#00AA00', // 🟢 Зелёный для новых структурных узлов
                edgeColor: 'rgba(100, 100, 100, 0.25)',
                background: '#FFFFFF'
            },
         
            legendPosition: options.legendPosition || 'bottom',
            showStats: options.showStats !== false,
            debug: options.debug || false,
            showEdges: options.showEdges !== false,
            ...options
        };
     
        // Создаем директорию
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
     
        console.log('🎨 ClusterVisualizer создан (режим: ПОКАЗЫВАТЬ ВСЕ УЗЛЫ)');
    }
 
    // 🔥 ГЛАВНЫЙ МЕТОД: Визуализация топологической модели
    async visualizeTopologicalModel(topologyData, options = {}) {
        console.log('\n🎨 ВИЗУАЛИЗАЦИЯ ТОПОЛОГИЧЕСКОЙ МОДЕЛИ...');
     
        try {
            // 🔥 БЕРЁМ ВСЕ ТОЧКИ ИЗ МОДЕЛИ!
            const allPoints = topologyData.points || [];
           
            if (allPoints.length === 0) {
                console.log('⚠️ Нет точек для визуализации');
                return this.createTopologyReport(topologyData, null);
            }
         
            console.log(`🔍 ВСЕГО УЗЛОВ В МОДЕЛИ: ${allPoints.length}`);
           
            // 🔥 ГРУППИРУЕМ ПО ТИПУ
            const structuralNodes = allPoints.filter(p =>
                p.addedFrom === 'structural_enhancement' ||
                (p.id && p.id.includes('structural_node'))
            );
           
            const originalNodes = allPoints.filter(p =>
                p.addedFrom !== 'structural_enhancement' &&
                !(p.id && p.id.includes('structural_node'))
            );
           
            console.log(`   📍 Оригинальных узлов: ${originalNodes.length}`);
            console.log(`   🆕 Структурных узлов: ${structuralNodes.length}`);
            console.log(`   ✅ Узлов с координатами: ${allPoints.filter(p => p.x && p.y).length}`);
         
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
                    `Всего узлов: ${stats.totalNodes}`,
                    `Рёбер: ${stats.totalEdges || 0}`,
                    `Ср. степень: ${stats.avgDegree?.toFixed(2) || '?'}`,
                    `🔴 Ядра (4+): ${stats.core || 0}`,
                    `🟠 Стабильные (3): ${stats.stable || 0}`,
                    `🟡 Подтверждённые (2): ${stats.confirmed || 0}`,
                    `🔵 Новые (1): ${stats.newish || 0}`,
                    `🆕 Структурные: ${structuralNodes.length}`
                ];
             
                statRows.forEach((text, index) => {
                    ctx.fillText(text, 50, 120 + index * 25);
                });
            }
         
            // 🔥 4. ВЫЧИСЛЯЕМ ГРАНИЦЫ ДЛЯ ВСЕХ ТОЧЕК
            const bounds = this.calculateBounds(allPoints);
            const scale = this.calculateScale(
                bounds.minX, bounds.maxX,
                bounds.minY, bounds.maxY,
                canvasWidth * 0.7, canvasHeight * 0.5
            );
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight * 0.6;
         
            console.log(`📐 Параметры отрисовки:`);
            console.log(`   Границы: x[${bounds.minX.toFixed(1)}-${bounds.maxX.toFixed(1)}], y[${bounds.minY.toFixed(1)}-${bounds.maxY.toFixed(1)}]`);
            console.log(`   Масштаб: ${scale.toFixed(3)}`);
            console.log(`   Центр: (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
         
            // 5. РИСУЕМ РЁБРА (если есть)
            if (this.config.showEdges && topologyData.edges && topologyData.edges.length > 0) {
                this.drawTopologyEdges(ctx, topologyData, bounds, scale, centerX, centerY);
            }
         
            // 🔥 6. РИСУЕМ ВСЕ УЗЛЫ!
            console.log(`\n🖌️ ОТРИСОВКА УЗЛОВ:`);
           
            // Сначала рисуем структурные узлы (чтобы они были под основными)
            this.drawNodes(ctx, structuralNodes, bounds, scale, centerX, centerY, true);
           
            // Потом рисуем оригинальные узлы
            this.drawNodes(ctx, originalNodes, bounds, scale, centerX, centerY, false);
         
            // 7. ЛЕГЕНДА
            this.drawTopologyLegend(ctx, canvasWidth, canvasHeight, structuralNodes.length);
         
            // 8. ИНФОРМАЦИЯ О СИСТЕМЕ
            ctx.fillStyle = '#ADB5BD';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(
                `🏗️ Делоне + WL | Система доверия | ${new Date().toLocaleString('ru-RU')}`,
                canvasWidth / 2, canvasHeight - 10
            );
         
            // 9. СОХРАНЯЕМ
            const filename = options.filename || `topology_${Date.now()}.png`;
            const outputPath = path.join(this.config.outputDir, filename);
         
            return new Promise((resolve, reject) => {
                const out = fs.createWriteStream(outputPath);
                const stream = canvasInstance.createPNGStream();
             
                stream.pipe(out);
             
                out.on('finish', () => {
                    console.log(`\n✅ Топологическая визуализация сохранена: ${outputPath}`);
                    console.log(`📊 ИТОГ ОТРИСОВКИ:`);
                    console.log(`   - Оригинальных узлов: ${originalNodes.length}`);
                    console.log(`   - Структурных узлов: ${structuralNodes.length}`);
                    console.log(`   - ВСЕГО УЗЛОВ: ${originalNodes.length + structuralNodes.length}`);
                 
                    resolve({
                        path: outputPath,
                        stats: topologyData.stats,
                        success: true,
                        topological: true,
                        nodesVisualized: originalNodes.length + structuralNodes.length,
                        structuralNodes: structuralNodes.length
                    });
                });
             
                out.on('error', reject);
            });
         
        } catch (error) {
            console.error('❌ Ошибка визуализации:', error);
            return this.createTopologyReport(topologyData, error);
        }
    }
 
    // 🔥 РИСОВАНИЕ УЗЛОВ (С РАЗНЫМИ ЦВЕТАМИ ПО ПОДТВЕРЖДЕНИЯМ)
    drawNodes(ctx, nodes, bounds, scale, centerX, centerY, isStructural = false) {
        if (nodes.length === 0) return;
       
        const type = isStructural ? 'Структурных' : 'Оригинальных';
        console.log(`   Рисую ${type} узлов: ${nodes.length}`);
       
        let drawnCount = 0;
       
        nodes.forEach(node => {
            if (!node || node.x === undefined || node.y === undefined) {
                console.log(`      ⚠️ Узел без координат: ${node?.id?.substring(0, 20) || 'unknown'}`);
                return;
            }
           
            // 🔥 ПРЕОБРАЗУЕМ КООРДИНАТЫ
            const x = centerX + (node.x - (bounds.minX + bounds.maxX) / 2) * scale;
            const y = centerY + (node.y - (bounds.minY + bounds.maxY) / 2) * scale;
           
            // 🔥 БЕРЁМ ПОДТВЕРЖДЕНИЯ ПРЯМО ИЗ УЗЛА!
            const confirmations = node.confirmationCount || 0;
            const streak = node.unconfirmedStreak || 0;
           
            // 🔥 ОПРЕДЕЛЯЕМ ЦВЕТ ПО КОЛИЧЕСТВУ ПОДТВЕРЖДЕНИЙ
            let color;
            if (confirmations >= 4) color = this.config.pointColors.core;      // 🔴 Красный
            else if (confirmations >= 3) color = this.config.pointColors.stable; // 🟠 Оранжевый
            else if (confirmations >= 2) color = this.config.pointColors.confirmed; // 🟡 Жёлтый
            else if (confirmations >= 1) color = this.config.pointColors.newish; // 🔵 Синий
            else color = this.config.pointColors.fading;                       // ⚪ Серый
           
            // 🔥 РАЗМЕР: от количества подтверждений
            let size = 4;
            if (confirmations >= 4) size = 12;
            else if (confirmations >= 3) size = 10;
            else if (confirmations >= 2) size = 8;
            else if (confirmations >= 1) size = 6;
           
            // 🔥 СТРУКТУРНЫЕ УЗЛЫ - чуть меньше, с зелёной окантовкой
            if (isStructural) {
                size = size * 0.9;
            }
           
            // 🔥 РИСУЕМ УЗЕЛ
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
           
            // Заливка
            ctx.fillStyle = color;
            ctx.fill();
           
            // Обводка
            ctx.strokeStyle = isStructural ? '#00AA00' : '#FFFFFF';
            ctx.lineWidth = isStructural ? 2 : 1.5;
            ctx.stroke();
           
            // 🔥 ДЛЯ СТРУКТУРНЫХ УЗЛОВ - добавляем метку
            if (isStructural) {
                ctx.fillStyle = '#00AA00';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('+', x, y - size - 5);
            }
           
            // 🔥 ДЛЯ УЗЛОВ С ВЫСОКИМ ДОВЕРИЕМ - показываем количество
            if (confirmations >= 3 && !isStructural) {
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(confirmations.toString(), x, y);
            }
           
            drawnCount++;
           
            // 🔥 ДЕБАГ: первые 3 узла
            if (this.config.debug && drawnCount <= 3) {
                console.log(`      ${drawnCount}. ${node.id?.substring(0, 20) || 'node'}`);
                console.log(`         коорд: (${node.x.toFixed(1)}, ${node.y.toFixed(1)}) → экран: (${x.toFixed(0)}, ${y.toFixed(0)})`);
                console.log(`         подтверждений: ${confirmations}, цвет: ${color}`);
                console.log(`         тип: ${isStructural ? 'СТРУКТУРНЫЙ' : 'ОРИГИНАЛЬНЫЙ'}`);
            }
        });
       
        console.log(`      ✅ Отрисовано ${drawnCount}/${nodes.length} ${type} узлов`);
    }
 
    // 🔥 РИСОВАНИЕ РЁБЕР
    drawTopologyEdges(ctx, topologyData, bounds, scale, centerX, centerY) {
        const pointsMap = new Map();
       
        // Создаем карту для быстрого поиска точек
        topologyData.points.forEach(point => {
            if (point && point.id) {
                pointsMap.set(point.id, point);
            }
        });
     
        ctx.strokeStyle = this.config.pointColors.edgeColor;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.25;
     
        let edgesDrawn = 0;
       
        topologyData.edges.forEach(edgeStr => {
            const [nodeAId, nodeBId] = edgeStr.split('--');
            const pointA = pointsMap.get(nodeAId);
            const pointB = pointsMap.get(nodeBId);
         
            if (pointA && pointB && pointA.x && pointA.y && pointB.x && pointB.y) {
                const x1 = centerX + (pointA.x - (bounds.minX + bounds.maxX) / 2) * scale;
                const y1 = centerY + (pointA.y - (bounds.minY + bounds.maxY) / 2) * scale;
                const x2 = centerX + (pointB.x - (bounds.minX + bounds.maxX) / 2) * scale;
                const y2 = centerY + (pointB.y - (bounds.minY + bounds.maxY) / 2) * scale;
             
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
               
                edgesDrawn++;
            }
        });
     
        ctx.globalAlpha = 1.0;
        console.log(`   🔗 Рёбер отрисовано: ${edgesDrawn}`);
    }
 
    // 🔥 ЛЕГЕНДА
    drawTopologyLegend(ctx, canvasWidth, canvasHeight, structuralCount = 0) {
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
        ctx.fillText('📋 СИСТЕМА ДОВЕРИЯ', startX, legendY);
     
        // Элементы легенды
        const legendItems = [
            { color: this.config.pointColors.core, text: '🔴 Ядра', desc: '4+ подтверждений' },
            { color: this.config.pointColors.stable, text: '🟠 Стабильные', desc: '3 подтверждения' },
            { color: this.config.pointColors.confirmed, text: '🟡 Подтверждённые', desc: '2 подтверждения' },
            { color: this.config.pointColors.newish, text: '🔵 Новые', desc: '1 подтверждение' },
            { color: this.config.pointColors.fading, text: '⚪ Затухающие', desc: '0 подтверждений' }
        ];
     
        legendItems.forEach((item, index) => {
            const x = startX + (index % 3) * columnWidth;
            const y = legendY + 20 + Math.floor(index / 3) * 35;
         
            // Рисуем точку
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(x + 15, y + 8, 6, 0, Math.PI * 2);
            ctx.fill();
         
            // Обводка
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();
         
            // Текст
            ctx.fillStyle = '#495057';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(item.text, x + 35, y + 5);
         
            ctx.fillStyle = '#6C757D';
            ctx.font = '10px Arial';
            ctx.fillText(item.desc, x + 35, y + 18);
        });
     
        // 🔥 СПЕЦИАЛЬНАЯ ЛЕГЕНДА ДЛЯ СТРУКТУРНЫХ УЗЛОВ
        if (structuralCount > 0) {
            const x = startX + columnWidth * 2;
            const y = legendY + 55;
         
            // Рисуем структурный узел
            ctx.fillStyle = this.config.pointColors.newish;
            ctx.beginPath();
            ctx.arc(x + 15, y + 8, 6, 0, Math.PI * 2);
            ctx.fill();
           
            // Зелёная обводка
            ctx.strokeStyle = '#00AA00';
            ctx.lineWidth = 2;
            ctx.stroke();
           
            // Метка +
            ctx.fillStyle = '#00AA00';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+', x + 15, y + 3);
         
            // Текст
            ctx.fillStyle = '#495057';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('🆕 Структурные узлы', x + 35, y + 5);
         
            ctx.fillStyle = '#6C757D';
            ctx.font = '10px Arial';
            ctx.fillText(`добавленные при улучшении (${structuralCount})`, x + 35, y + 18);
        }
    }
 
    // 🔥 РАСЧЁТ ГРАНИЦ
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
 
    // 🔥 РАСЧЁТ МАСШТАБА
    calculateScale(minX, maxX, minY, maxY, targetWidth, targetHeight) {
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
     
        const scaleX = targetWidth / width;
        const scaleY = targetHeight / height;
     
        return Math.min(scaleX, scaleY, 3);
    }
 
    // 🔥 ТЕКСТОВЫЙ ОТЧЁТ
    createTopologyReport(topologyData, error = null) {
        const outputPath = path.join(this.config.outputDir, `topology_report_${Date.now()}.txt`);
     
        let report = `🏗️ ОТЧЁТ О ТОПОЛОГИЧЕСКОЙ МОДЕЛИ\n`;
        report += `═`.repeat(60) + `\n\n`;
     
        if (error) {
            report += `❌ ОШИБКА: ${error.message}\n\n`;
        }
     
        if (topologyData) {
            report += `📋 МОДЕЛЬ: ${topologyData.modelName || 'Неизвестная'}\n`;
            report += `🆔 ID: ${topologyData.modelId || 'N/A'}\n\n`;
         
            if (topologyData.stats) {
                const stats = topologyData.stats;
                report += `📊 СТАТИСТИКА:\n`;
                report += `   Всего узлов: ${stats.totalNodes}\n`;
                report += `   Рёбер: ${stats.totalEdges || 0}\n`;
                report += `   🔴 Ядра (4+): ${stats.core || 0}\n`;
                report += `   🟠 Стабильные (3): ${stats.stable || 0}\n`;
                report += `   🟡 Подтверждённые (2): ${stats.confirmed || 0}\n`;
                report += `   🔵 Новые (1): ${stats.newish || 0}\n`;
                report += `   ⚪ Затухающие: ${stats.fading || 0}\n`;
            }
         
            const points = topologyData.points || [];
            const structuralNodes = points.filter(p => p.addedFrom === 'structural_enhancement' || p.id?.includes('structural_node'));
            const originalNodes = points.filter(p => !p.addedFrom && !p.id?.includes('structural_node'));
         
            report += `\n📍 УЗЛЫ:\n`;
            report += `   Оригинальных: ${originalNodes.length}\n`;
            report += `   Структурных: ${structuralNodes.length}\n`;
            report += `   С координатами: ${points.filter(p => p.x && p.y).length}\n`;
        }
     
        fs.writeFileSync(outputPath, report, 'utf8');
     
        return {
            path: outputPath,
            stats: topologyData?.stats || null,
            note: 'Текстовый отчёт',
            error: error?.message
        };
    }
 
    // 🔥 СОВМЕСТИМОСТЬ СО СТАРЫМ КОДОМ
    async visualizeSingleFootprintConfirmations(footprint, options = {}) {
        console.log('🎨 [Совместимость] Используется топологическая визуализация');
     
        if (options.topologyData) {
            return await this.visualizeTopologicalModel(options.topologyData, options);
        }
     
        return {
            success: false,
            note: 'Нет топологических данных для визуализации'
        };
    }
}

module.exports = ClusterVisualizer;
