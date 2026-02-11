// modules/footprint/visualizations/cluster-visualizer.js
// 🎨 ТОПОЛОГИЧЕСКАЯ ВИЗУАЛИЗАЦИЯ С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ

const fs = require('fs');
const path = require('path');

class ClusterVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './data/footprints/visualizations/topology',
            canvasWidth: options.canvasWidth || 1200,
            canvasHeight: options.canvasHeight || 800,
          
            // 🔥 ЦВЕТОВАЯ СХЕМА ПО УРОВНЮ ДОВЕРИЯ
            pointColors: {
                core: '#FF0000',      // 🔴 4+ подтверждений
                stable: '#FF6B00',    // 🟠 3 подтверждения
                confirmed: '#FFC107', // 🟡 2 подтверждения
                newish: '#2196F3',    // 🔵 1 подтверждение
                fading: '#BDBDBD',    // ⚪ Затухающие
                hidden: '#E0E0E0',    // 🙈 Скрытые
                edgeColor: 'rgba(100, 100, 100, 0.25)',
                background: '#FFFFFF'
            },
          
            legendPosition: options.legendPosition || 'bottom',
            showStats: options.showStats !== false,
            showEdges: options.showEdges !== false,
            showGeometry: options.showGeometry !== false,
            debug: options.debug || false,
            ...options
        };
      
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
      
        console.log('🎨 ClusterVisualizer создан (режим: ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ)');
    }
  
    // 🔥 ГЛАВНЫЙ МЕТОД
    async visualizeTopologicalModel(topologyData, options = {}) {
        console.log('\n🎨 ВИЗУАЛИЗАЦИЯ ТОПОЛОГИЧЕСКОЙ МОДЕЛИ...');
      
        try {
            if (!topologyData?.points || topologyData.points.length === 0) {
                return this.createTopologyReport(topologyData, null);
            }
          
            // 🔥 ДИАГНОСТИКА ПЕРЕД ВИЗУАЛИЗАЦИЕЙ
            const allPoints = topologyData.points;
            const structuralNodes = allPoints.filter(p =>
                p.addedFrom === 'structural_enhancement' ||
                p.id?.includes('structural_node')
            );
          
            const originalNodes = allPoints.filter(p =>
                p.addedFrom !== 'structural_enhancement' &&
                !p.id?.includes('structural_node')
            );
          
            const nodesWithGeometry = allPoints.filter(p => p.geometryMemory);
          
            console.log(`🔍 ДИАГНОСТИКА МОДЕЛИ:`);
            console.log(`   📍 Всего узлов: ${allPoints.length}`);
            console.log(`   📐 С геометрической памятью: ${nodesWithGeometry.length}`);
            console.log(`   🆕 Структурных узлов: ${structuralNodes.length}`);
            console.log(`   📍 Оригинальных узлов: ${originalNodes.length}`);
            console.log(`   ✅ С координатами: ${allPoints.filter(p => p.x && p.y).length}`);
          
            // Проверяем canvas
            let canvas;
            try {
                canvas = require('canvas');
            } catch (error) {
                console.log('⚠️ Canvas не доступен, создаю отчёт');
                return this.createTopologyReport(topologyData, null);
            }
          
            const canvasWidth = options.width || this.config.canvasWidth;
            const canvasHeight = options.height || this.config.canvasHeight;
          
            const canvasInstance = canvas.createCanvas(canvasWidth, canvasHeight);
            const ctx = canvasInstance.getContext('2d');
          
            // Фон
            ctx.fillStyle = this.config.pointColors.background;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          
            // Заголовок
            ctx.fillStyle = '#212529';
            ctx.font = 'bold 26px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`🏗️ ТОПОЛОГИЧЕСКАЯ МОДЕЛЬ`, canvasWidth / 2, 45);
          
            if (topologyData.modelName) {
                ctx.font = '18px Arial';
                ctx.fillStyle = '#495057';
                ctx.fillText(topologyData.modelName, canvasWidth / 2, 75);
            }
          
            ctx.font = '14px Arial';
            ctx.fillStyle = '#6C757D';
            ctx.fillText('📐 Геометрическая память • Инвариантные отношения', canvasWidth / 2, 100);
          
            // Статистика
            if (topologyData.stats) {
                ctx.font = '16px Arial';
                ctx.fillStyle = '#343A40';
                ctx.textAlign = 'left';
              
                const stats = topologyData.stats;
                const statRows = [
                    `Всего узлов: ${stats.totalNodes} (восст: ${stats.geometryRecovered || 0})`,
                    `Рёбер: ${stats.totalEdges || 0}`,
                    `🔴 Ядра: ${stats.core || 0}`,
                    `🟠 Стабильные: ${stats.stable || 0}`,
                    `🟡 Подтверждённые: ${stats.confirmed || 0}`,
                    `🔵 Новые: ${stats.newish || 0}`,
                    `⚪ Затухающие: ${stats.fading || 0}`
                ];
              
                statRows.forEach((text, index) => {
                    ctx.fillText(text, 50, 150 + index * 30);
                });
            }
          
            // 🔥 РИСУЕМ РЁБРА
            if (this.config.showEdges && topologyData.edges) {
                this.drawTopologyEdges(ctx, topologyData, canvasWidth, canvasHeight);
            }
          
            // 🔥 РИСУЕМ УЗЛЫ - ВСЕ, БЕЗ ФИЛЬТРАЦИИ!
            this.drawTopologyNodes(ctx, topologyData, canvasWidth, canvasHeight);
          
            // Легенда
            this.drawTopologyLegend(ctx, canvasWidth, canvasHeight);
          
            // Информация
            ctx.fillStyle = '#ADB5BD';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`🏗️ Триангуляция Делоне + WL + Геометрическая память | ${new Date().toLocaleString('ru-RU')}`,
                        canvasWidth / 2, canvasHeight - 10);
          
            // Сохраняем
            const filename = options.filename || `topology_${Date.now()}.png`;
            const outputPath = path.join(this.config.outputDir, filename);
          
            return new Promise((resolve, reject) => {
                const out = fs.createWriteStream(outputPath);
                const stream = canvasInstance.createPNGStream();
              
                stream.pipe(out);
              
                out.on('finish', () => {
                    console.log(`✅ Визуализация сохранена: ${outputPath}`);
                    console.log(`📊 ИТОГ ОТРИСОВКИ:`);
                    console.log(`   - Всего узлов: ${allPoints.length}`);
                    console.log(`   - Структурных узлов: ${structuralNodes.length}`);
                    console.log(`   - С геометрией: ${nodesWithGeometry.length}`);
                  
                    resolve({
                        path: outputPath,
                        stats: topologyData.stats,
                        success: true,
                        nodesVisualized: allPoints.length,
                        geometryRecovered: nodesWithGeometry.length
                    });
                });
              
                out.on('error', reject);
            });
          
        } catch (error) {
            console.error('❌ Ошибка визуализации:', error);
            return this.createTopologyReport(topologyData, error);
        }
    }
  
    // 🔥 РИСОВАНИЕ УЗЛОВ - ГЛАВНОЕ ИСПРАВЛЕНИЕ!
    drawTopologyNodes(ctx, topologyData, canvasWidth, canvasHeight) {
        // 🔥 БЕРЁМ ВСЕ ТОЧКИ БЕЗ ИСКЛЮЧЕНИЯ
        const allPoints = topologyData.points.filter(p => p && p.x !== undefined && p.y !== undefined);
      
        if (allPoints.length === 0) {
            console.log('⚠️ Нет точек с координатами');
            return;
        }
      
        const { minX, maxX, minY, maxY } = this.calculateBounds(allPoints);
        const scale = this.calculateScale(minX, maxX, minY, maxY, canvasWidth * 0.7, canvasHeight * 0.5);
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight * 0.6;
      
        console.log(`🖌 ОТРИСОВКА УЗЛОВ:`);
        console.log(`   Всего узлов: ${allPoints.length}`);
        console.log(`   Границы: x[${minX.toFixed(1)}-${maxX.toFixed(1)}], y[${minY.toFixed(1)}-${maxY.toFixed(1)}]`);
        console.log(`   Масштаб: ${scale.toFixed(3)}`);
      
        // 🔥 РИСУЕМ КАЖДЫЙ УЗЕЛ!
        let drawnCount = 0;
        let structuralCount = 0;
        let geometryCount = 0;
      
        allPoints.forEach(point => {
            const x = centerX + (point.x - (minX + maxX) / 2) * scale;
            const y = centerY + (point.y - (minY + maxY) / 2) * scale;
          
            // 🔥 БЕРЁМ ПАРАМЕТРЫ ПРЯМО ИЗ УЗЛА!
            const confirmations = point.confirmationCount || 1;
            const streak = point.unconfirmedStreak || 0;
            const isStructural = point.addedFrom === 'structural_enhancement' || point.id?.includes('structural_node');
            const hasGeometry = !!point.geometryMemory;
          
            // 🔥 ОПРЕДЕЛЯЕМ ЦВЕТ ПО ПОДТВЕРЖДЕНИЯМ
            let color;
            if (streak >= 10) color = this.config.pointColors.hidden;
            else if (streak >= 5) color = this.config.pointColors.fading;
            else if (confirmations >= 4) color = this.config.pointColors.core;
            else if (confirmations >= 3) color = this.config.pointColors.stable;
            else if (confirmations >= 2) color = this.config.pointColors.confirmed;
            else color = this.config.pointColors.newish;
          
            // 🔥 РАЗМЕР
            let size = confirmations >= 4 ? 12 :
                      confirmations >= 3 ? 10 :
                      confirmations >= 2 ? 8 : 6;
                     
            if (isStructural) size = size * 0.9; // чуть меньше
          
            // 🔥 РИСУЕМ!
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          
            // Обводка
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          
            // 🔥 МАРКЕР ГЕОМЕТРИЧЕСКОЙ ПАМЯТИ
            if (hasGeometry && this.config.showGeometry) {
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('📐', x, y - size - 5);
            }
          
            // 🔥 ПОДПИСЬ ДЛЯ СТРУКТУРНЫХ УЗЛОВ
            if (isStructural && !hasGeometry) {
                ctx.fillStyle = '#000000';
                ctx.font = '8px Arial';
                ctx.fillText('+', x, y - size - 2);
            }
          
            drawnCount++;
            if (isStructural) structuralCount++;
            if (hasGeometry) geometryCount++;
        });
      
        console.log(`   ✅ Отрисовано: ${drawnCount} узлов`);
        console.log(`      🆕 Структурных: ${structuralCount}`);
        console.log(`      📐 С геометрией: ${geometryCount}`);
    }
  
    // 🔥 РИСОВАНИЕ РЁБЕР
    drawTopologyEdges(ctx, topologyData, canvasWidth, canvasHeight) {
        const pointsMap = new Map();
        topologyData.points.forEach(point => {
            if (point && point.id) pointsMap.set(point.id, point);
        });
      
        const validPoints = topologyData.points.filter(p => p && p.x && p.y);
        if (validPoints.length === 0) return;
      
        const { minX, maxX, minY, maxY } = this.calculateBounds(validPoints);
        const scale = this.calculateScale(minX, maxX, minY, maxY, canvasWidth * 0.7, canvasHeight * 0.5);
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight * 0.6;
      
        ctx.strokeStyle = this.config.pointColors.edgeColor;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.25;
      
        let drawnEdges = 0;
        topologyData.edges.forEach(edgeStr => {
            const [aId, bId] = edgeStr.split('--');
            const a = pointsMap.get(aId);
            const b = pointsMap.get(bId);
          
            if (a && b && a.x && a.y && b.x && b.y) {
                const x1 = centerX + (a.x - (minX + maxX) / 2) * scale;
                const y1 = centerY + (a.y - (minY + maxY) / 2) * scale;
                const x2 = centerX + (b.x - (minX + maxX) / 2) * scale;
                const y2 = centerY + (b.y - (minY + maxY) / 2) * scale;
              
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                drawnEdges++;
            }
        });
      
        ctx.globalAlpha = 1.0;
        console.log(`   🔗 Рёбер отрисовано: ${drawnEdges}`);
    }
  
    // 🔥 ЛЕГЕНДА
    drawTopologyLegend(ctx, canvasWidth, canvasHeight) {
        const legendY = canvasHeight - 140;
        const startX = canvasWidth * 0.1;
        const columnWidth = canvasWidth * 0.2;
      
        // Фон
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(startX - 10, legendY - 20, canvasWidth * 0.8, 120);
        ctx.strokeStyle = '#DEE2E6';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX - 10, legendY - 20, canvasWidth * 0.8, 120);
      
        // Заголовок
        ctx.fillStyle = '#212529';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('📋 ЛЕГЕНДА', startX, legendY);
      
        // Цвета
        const legendItems = [
            { color: this.config.pointColors.core, text: '🔴 Ядра (4+)', desc: 'Непоколебимые' },
            { color: this.config.pointColors.stable, text: '🟠 Стабильные (3)', desc: 'Уверенные' },
            { color: this.config.pointColors.confirmed, text: '🟡 Подтверждённые (2)', desc: 'Рабочие' },
            { color: this.config.pointColors.newish, text: '🔵 Новые (1)', desc: 'Сомнительные' },
            { color: this.config.pointColors.fading, text: '⚪ Затухающие', desc: 'Почти исчезли' }
        ];
      
        legendItems.forEach((item, index) => {
            const x = startX + (index % 3) * columnWidth;
            const y = legendY + 20 + Math.floor(index / 3) * 40;
          
            // Точка
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(x + 15, y + 8, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
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
      
        // Геометрическая память
        ctx.fillStyle = '#212529';
        ctx.font = '12px Arial';
        ctx.fillText('📐 Геометрическая память', startX + columnWidth * 2 + 10, legendY + 70);
        ctx.fillStyle = '#6C757D';
        ctx.font = '10px Arial';
        ctx.fillText('Инвариантные отношения', startX + columnWidth * 2 + 10, legendY + 85);
    }
  
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    calculateBounds(points) {
        const valid = points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
        if (valid.length === 0) return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
      
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        valid.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });
      
        // Отступы
        const pad = Math.max(maxX - minX, maxY - minY) * 0.1;
        return {
            minX: minX - pad,
            maxX: maxX + pad,
            minY: minY - pad,
            maxY: maxY + pad
        };
    }
  
    calculateScale(minX, maxX, minY, maxY, targetWidth, targetHeight) {
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        return Math.min(targetWidth / width, targetHeight / height, 3);
    }
  
    // 🔥 ТЕКСТОВЫЙ ОТЧЁТ
    createTopologyReport(topologyData, error = null) {
        const outputPath = path.join(this.config.outputDir, `topology_report_${Date.now()}.txt`);
      
        let report = `🏗️ ОТЧЁТ О ТОПОЛОГИЧЕСКОЙ МОДЕЛИ\n`;
        report += `═`.repeat(60) + `\n\n`;
      
        if (error) report += `❌ ОШИБКА: ${error.message}\n\n`;
      
        if (topologyData) {
            report += `📋 МОДЕЛЬ: ${topologyData.modelName || 'Неизвестная'}\n`;
            report += `🆔 ID: ${topologyData.modelId || 'N/A'}\n`;
            report += `📐 Метод: Геометрическая память\n\n`;
          
            if (topologyData.stats) {
                const s = topologyData.stats;
                report += `📊 СТАТИСТИКА:\n`;
                report += `• Узлов: ${s.totalNodes}\n`;
                report += `• Рёбер: ${s.totalEdges || 0}\n`;
                report += `• 🔴 Ядра: ${s.core || 0}\n`;
                report += `• 🟠 Стабильные: ${s.stable || 0}\n`;
                report += `• 🟡 Подтверждённые: ${s.confirmed || 0}\n`;
                report += `• 🔵 Новые: ${s.newish || 0}\n`;
                report += `• ⚪ Затухающие: ${s.fading || 0}\n`;
                report += `• 📐 Восстановлено: ${s.geometryRecovered || 0}\n\n`;
            }
          
            report += `🎯 ФИЛОСОФИЯ:\n`;
            report += `• Чистая топология (WL-подписи)\n`;
            report += `• Геометрическая память (инвариантные отношения)\n`;
            report += `• Динамическое доверие (затухание шума)\n`;
        }
      
        fs.writeFileSync(outputPath, report, 'utf8');
        return { path: outputPath, note: 'Текстовый отчёт', error: error?.message };
    }
}

module.exports = ClusterVisualizer;
