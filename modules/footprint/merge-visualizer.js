// modules/footprint/merge-visualizer.js
// ПРОСТОЙ ВИЗУАЛИЗАТОР ТОПОЛОГИЧЕСКИХ СУПЕР-МОДЕЛЕЙ (ПЕРЕПИСАН С НУЛЯ)

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

class MergeVisualizer {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || './temp/merge_visualizations',
            width: options.width || 1200,
            height: options.height || 900,
            backgroundColor: options.backgroundColor || '#ffffff', // Белый фон
            debug: options.debug || false,
            ...options
        };
      
        // Создать директорию для визуализаций
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
      
        console.log(`🎨 MergeVisualizer создан: ${this.config.width}x${this.config.height}`);
        console.log(`   📁 Выходная директория: ${this.config.outputDir}`);
    }

    // 1. ВИЗУАЛИЗАЦИЯ ТОПОЛОГИЧЕСКОЙ СУПЕР-МОДЕЛИ (ОСНОВНОЙ МЕТОД)
    async visualizeTopologyMerge(footprint1, footprint2, comparisonResult, options = {}) {
        const timestamp = Date.now();
        const outputPath = options.outputPath ||
                          path.join(this.config.outputDir, `topology_merge_${timestamp}.png`);
      
        console.log(`🎨 Создаю визуализацию топологического слияния...`);
        console.log(`   📊 Схожесть: ${comparisonResult?.similarity?.toFixed(3) || 'N/A'}`);
      
        try {
            // Получаем данные из результата слияния
            const mergeResult = comparisonResult?.mergeResult || options.mergeResult;
            const topologyResult = mergeResult?.topologyMergeResult;
          
            // Получаем графы
            const graph1 = footprint1?.graph || footprint1;
            const graph2 = footprint2?.graph || footprint2;
            const mergedGraph = topologyResult?.mergedGraph || graph1;
          
            if (!graph1 || !graph2 || !mergedGraph) {
                throw new Error('Нет данных графов для визуализации');
            }
          
            // Создаем канвас
            const canvas = createCanvas(this.config.width, this.config.height);
            const ctx = canvas.getContext('2d');
          
            // 1. ФОН
            ctx.fillStyle = this.config.backgroundColor;
            ctx.fillRect(0, 0, this.config.width, this.config.height);
          
            // 2. РАСЧЕТ МАСШТАБОВ И СМЕЩЕНИЙ
            const bounds = this.calculateCombinedBounds(graph1, graph2);
            const transform = this.calculateTransform(bounds, {
                width: this.config.width - 200, // Оставляем место для статистики
                height: this.config.height - 100,
                padding: 50
            });
          
            // 3. ОТРИСОВКА СЛИТОГО ГРАФА (СУПЕР-МОДЕЛЬ)
            console.log('   🎯 Рисую топологическую супер-модель...');
            this.drawSuperModel(ctx, mergedGraph, transform, options);
          
            // 4. ВЫДЕЛЕНИЕ ПОСЛЕДНЕГО СЛЕДА (ЧЕРНЫМ КРУГОМ)
            console.log('   🔍 Выделяю последний след...');
            this.drawLastTraceHighlight(ctx, graph2, transform, options);
          
            // 5. СТАТИСТИКА И ИНФОРМАЦИЯ
            console.log('   📊 Добавляю статистику...');
            this.drawStatistics(ctx, {
                graph1: graph1,
                graph2: graph2,
                mergedGraph: mergedGraph,
                comparison: comparisonResult,
                topologyResult: topologyResult,
                timestamp: new Date()
            }, this.config.width, this.config.height);
          
            // 6. ЗАГОЛОВОК
            this.drawHeader(ctx, 'ТОПОЛОГИЧЕСКАЯ СУПЕР-МОДЕЛЬ', comparisonResult?.similarity || 0);
          
            // 7. ЛЕГЕНДА
            this.drawLegend(ctx, this.config.width - 200, 50);
          
            // 8. СОХРАНЕНИЕ
            await this.saveCanvas(canvas, outputPath);
          
            console.log(`✅ Визуализация создана: ${outputPath}`);
          
            return {
                success: true,
                path: outputPath,
                stats: this.extractStats(comparisonResult, topologyResult),
                canvas: canvas
            };
          
        } catch (error) {
            console.log(`❌ Ошибка создания визуализации: ${error.message}`);
            return await this.createSimpleFallback(footprint1, footprint2, comparisonResult, outputPath);
        }
    }

    // 2. ОТРИСОВКА СУПЕР-МОДЕЛИ
    drawSuperModel(ctx, mergedGraph, transform, options) {
        if (!mergedGraph || !mergedGraph.nodes) return;
      
        const nodes = Array.from(mergedGraph.nodes.values());
        const edges = Array.from(mergedGraph.edges.values());
      
        // Сначала рёбра (чтобы были под узлами)
        edges.forEach(edge => {
            const fromNode = mergedGraph.nodes.get(edge.from);
            const toNode = mergedGraph.nodes.get(edge.to);
          
            if (fromNode && toNode) {
                const from = transform(fromNode.x, fromNode.y);
                const to = transform(toNode.x, toNode.y);
              
                // Проверяем, является ли ребро подтверждённым (совпадающим)
                const isConfirmed = this.isEdgeConfirmed(edge, mergedGraph);
              
                ctx.strokeStyle = isConfirmed ? '#ff0000' : '#cccccc';
                ctx.lineWidth = isConfirmed ? 2 : 1;
                ctx.lineCap = 'round';
              
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
            }
        });
      
        // Затем узлы (сверху)
        nodes.forEach((node, index) => {
            const pos = transform(node.x, node.y);
          
            // Определяем цвет узла на основе подтверждений
            const confirmationCount = node.confirmationCount || 0;
            const isConfirmed = confirmationCount > 0;
          
            let color, radius, textColor;
          
            if (isConfirmed) {
                // Подтверждённые узлы (зелёный)
                color = '#00aa00';
                radius = 5;
                textColor = '#ffffff';
            } else {
                // Неподтверждённые узлы (чёрный)
                color = '#000000';
                radius = 3;
                textColor = '#ffffff';
            }
          
            // Круг узла
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();
          
            // Белая обводка для лучшей видимости
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.stroke();
          
            // Номер подтверждений (только для подтверждённых узлов)
            if (isConfirmed && confirmationCount > 0) {
                ctx.fillStyle = textColor;
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(confirmationCount.toString(), pos.x, pos.y);
            }
        });
    }

    // 3. ВЫДЕЛЕНИЕ ПОСЛЕДНЕГО СЛЕДА
    drawLastTraceHighlight(ctx, lastGraph, transform, options) {
        if (!lastGraph || !lastGraph.nodes) return;
      
        const nodes = Array.from(lastGraph.nodes.values());
      
        // Обводим каждый узел последнего следа чёрным кругом
        nodes.forEach(node => {
            const pos = transform(node.x, node.y);
          
            // Чёрный круг (только обводка)
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 3]); // Пунктирная линия
          
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
            ctx.stroke();
          
            ctx.setLineDash([]); // Сбросить пунктир
        });
    }

    // 4. СТАТИСТИКА
    drawStatistics(ctx, data, width, height) {
        const statsX = 30;
        let statsY = height - 250;
        const lineHeight = 22;
      
        // Фон статистики
        ctx.fillStyle = 'rgba(240, 240, 240, 0.8)';
        ctx.fillRect(statsX - 10, statsY - 10, 350, 220);
      
        // Заголовок статистики
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('📊 СТАТИСТИКА СЛИЯНИЯ', statsX, statsY);
        statsY += lineHeight + 5;
      
        ctx.font = '14px Arial';
      
        // Количество узлов
        ctx.fillText(`• Узлов в 1-м следе: ${data.graph1?.nodes?.size || 0}`, statsX, statsY);
        statsY += lineHeight;
      
        ctx.fillText(`• Узлов в 2-м следе: ${data.graph2?.nodes?.size || 0}`, statsX, statsY);
        statsY += lineHeight;
      
        ctx.fillText(`• Узлов в супер-модели: ${data.mergedGraph?.nodes?.size || 0}`, statsX, statsY);
        statsY += lineHeight;
      
        // Схожесть
        if (data.comparison?.similarity) {
            const similarity = data.comparison.similarity;
            ctx.fillStyle = similarity > 0.7 ? '#00aa00' : similarity > 0.4 ? '#ff8800' : '#ff0000';
            ctx.fillText(`• Топологическая схожесть: ${(similarity * 100).toFixed(1)}%`, statsX, statsY);
            statsY += lineHeight;
            ctx.fillStyle = '#000000';
        }
      
        // Структурные соответствия
        if (data.topologyResult?.structuralMatches?.length) {
            ctx.fillText(`• Структурных соответствий: ${data.topologyResult.structuralMatches.length}`, statsX, statsY);
            statsY += lineHeight;
        }
      
        if (data.topologyResult?.structuralSimilarity) {
            ctx.fillText(`• Структурная схожесть: ${(data.topologyResult.structuralSimilarity * 100).toFixed(1)}%`, statsX, statsY);
            statsY += lineHeight;
        }
      
        // Подтверждённые узлы
        const confirmedNodes = this.countConfirmedNodes(data.mergedGraph);
        ctx.fillText(`• Подтверждённых узлов: ${confirmedNodes}`, statsX, statsY);
        statsY += lineHeight;
      
        // Дата и время
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666666';
        ctx.fillText(`🕒 ${data.timestamp.toLocaleString('ru-RU')}`, statsX, statsY);
    }

    // 5. ЗАГОЛОВОК
    drawHeader(ctx, title, similarity) {
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(title, 30, 40);
      
        ctx.font = '18px Arial';
        const similarityColor = similarity > 0.7 ? '#00aa00' : similarity > 0.4 ? '#ff8800' : '#ff0000';
        ctx.fillStyle = similarityColor;
        ctx.fillText(`Схожесть: ${(similarity * 100).toFixed(1)}%`, 30, 70);
    }

    // 6. ЛЕГЕНДА
    drawLegend(ctx, x, y) {
        const legendWidth = 180;
        const legendHeight = 150;
      
        // Фон легенды
        ctx.fillStyle = 'rgba(240, 240, 240, 0.8)';
        ctx.fillRect(x - 10, y - 10, legendWidth, legendHeight);
      
        let currentY = y;
        const lineHeight = 25;
      
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('🎨 ЛЕГЕНДА', x, currentY);
        currentY += lineHeight;
      
        ctx.font = '12px Arial';
      
        // Зелёный узел с цифрой
        ctx.fillStyle = '#00aa00';
        ctx.beginPath();
        ctx.arc(x + 10, currentY - 5, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.fillText('Подтверждённый узел (цифра = подтверждения)', x + 25, currentY);
        currentY += lineHeight;
      
        // Чёрный узел
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(x + 10, currentY - 5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.fillText('Неподтверждённый узел', x + 25, currentY);
        currentY += lineHeight;
      
        // Красное ребро
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, currentY - 5);
        ctx.lineTo(x + 20, currentY - 5);
        ctx.stroke();
        ctx.fillStyle = '#000000';
        ctx.fillText('Подтверждённая связь', x + 25, currentY);
        currentY += lineHeight;
      
        // Чёрный пунктирный круг
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.arc(x + 10, currentY - 5, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#000000';
        ctx.fillText('Последний след (новые данные)', x + 25, currentY);
    }

    // 7. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

    // Проверка, является ли ребро подтверждённым
    isEdgeConfirmed(edge, graph) {
        // Простая логика: если оба узла имеют подтверждения, то и ребро подтверждено
        const fromNode = graph.nodes.get(edge.from);
        const toNode = graph.nodes.get(edge.to);
      
        if (fromNode && toNode) {
            return (fromNode.confirmationCount || 0) > 0 && (toNode.confirmationCount || 0) > 0;
        }
      
        return false;
    }

    // Подсчёт подтверждённых узлов
    countConfirmedNodes(graph) {
        if (!graph || !graph.nodes) return 0;
      
        let confirmed = 0;
        graph.nodes.forEach(node => {
            if ((node.confirmationCount || 0) > 0) {
                confirmed++;
            }
        });
      
        return confirmed;
    }

    // Расчёт границ для всех графов
    calculateCombinedBounds(graph1, graph2) {
        const allNodes = [];
      
        // Собираем все узлы из первого графа
        if (graph1 && graph1.nodes) {
            graph1.nodes.forEach(node => allNodes.push({ x: node.x, y: node.y }));
        }
      
        // Собираем все узлы из второго графа
        if (graph2 && graph2.nodes) {
            graph2.nodes.forEach(node => allNodes.push({ x: node.x, y: node.y }));
        }
      
        if (allNodes.length === 0) {
            return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
        }
      
        return this.calculateNodesBounds(allNodes);
    }

    // Расчёт границ узлов
    calculateNodesBounds(nodes) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
      
        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x);
            minY = Math.min(minY, node.y);
            maxY = Math.max(maxY, node.y);
        });
      
        // Добавляем немного padding
        const paddingX = (maxX - minX) * 0.1 || 10;
        const paddingY = (maxY - minY) * 0.1 || 10;
      
        return {
            minX: minX - paddingX,
            maxX: maxX + paddingX,
            minY: minY - paddingY,
            maxY: maxY + paddingY
        };
    }

    // Расчёт трансформации координат
    calculateTransform(bounds, options) {
        const width = options.width || this.config.width;
        const height = options.height || this.config.height;
        const padding = options.padding || 50;
      
        const contentWidth = width - 2 * padding;
        const contentHeight = height - 2 * padding;
      
        const graphWidth = bounds.maxX - bounds.minX;
        const graphHeight = bounds.maxY - bounds.minY;
      
        // Рассчитываем масштаб, чтобы граф влез в область
        const scaleX = graphWidth > 0 ? contentWidth / graphWidth : 1;
        const scaleY = graphHeight > 0 ? contentHeight / graphHeight : 1;
        const scale = Math.min(scaleX, scaleY) * 0.9; // Оставляем немного места
      
        // Рассчитываем смещение
        const offsetX = padding - bounds.minX * scale + (contentWidth - graphWidth * scale) / 2;
        const offsetY = padding - bounds.minY * scale + (contentHeight - graphHeight * scale) / 2;
      
        return (x, y) => ({
            x: offsetX + x * scale,
            y: offsetY + y * scale
        });
    }

    // Извлечение статистики
    extractStats(comparisonResult, topologyResult) {
        return {
            similarity: comparisonResult?.similarity || 0,
            structuralSimilarity: topologyResult?.structuralSimilarity || 0,
            structuralMatches: topologyResult?.structuralMatches?.length || 0,
            timestamp: new Date().toISOString()
        };
    }

    // Простой запасной вариант
    async createSimpleFallback(footprint1, footprint2, comparisonResult, outputPath) {
        console.log('🔄 Создаю простую запасную визуализацию...');
      
        const canvas = createCanvas(this.config.width, this.config.height);
        const ctx = canvas.getContext('2d');
      
        // Фон
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, this.config.width, this.config.height);
      
        // Текст
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('🎯 ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ', 50, 50);
      
        ctx.font = '18px Arial';
        ctx.fillText(`Схожесть: ${(comparisonResult?.similarity * 100 || 0).toFixed(1)}%`, 50, 90);
      
        // Простая статистика
        ctx.font = '16px Arial';
        let y = 150;
        const lineHeight = 25;
      
        const nodes1 = footprint1?.graph?.nodes?.size || 0;
        const nodes2 = footprint2?.graph?.nodes?.size || 0;
      
        ctx.fillText(`Узлов в следе 1: ${nodes1}`, 50, y);
        y += lineHeight;
        ctx.fillText(`Узлов в следе 2: ${nodes2}`, 50, y);
        y += lineHeight;
        ctx.fillText(`Объединено успешно!`, 50, y);
      
        // Сохранение
        await this.saveCanvas(canvas, outputPath);
      
        console.log(`✅ Запасная визуализация создана: ${outputPath}`);
      
        return {
            success: true,
            path: outputPath,
            stats: {
                similarity: comparisonResult?.similarity || 0,
                nodes1: nodes1,
                nodes2: nodes2
            }
        };
    }

    // Вспомогательные методы для других типов визуализации
    async visualizeClassicMerge(footprint1, footprint2, comparisonResult, options) {
        // Простая обёртка для совместимости
        return await this.visualizeTopologyMerge(footprint1, footprint2, comparisonResult, options);
    }

    async visualizeIntelligentMerge(footprint1, footprint2, comparisonResult, options) {
        // Простая обёртка для совместимости
        return await this.visualizeTopologyMerge(footprint1, footprint2, comparisonResult, options);
    }

    // Метод для создания подписей к изображениям
    createTopologyMergeCaption(footprint1, footprint2, stats) {
        return `<b>🏗️ ТОПОЛОГИЧЕСКАЯ СУПЕР-МОДЕЛЬ</b>\n\n` +
               `<b>📸 ${footprint1?.name || 'След 1'}:</b> ${stats.points1 || 0} узлов\n` +
               `<b>📸 ${footprint2?.name || 'След 2'}:</b> ${stats.points2 || 0} узлов\n` +
               `<b>🔗 Структурных соответствий:</b> ${stats.structuralMatches || 0}\n` +
               `<b>🏗️ Топологическая схожесть:</b> ${(stats.structuralSimilarity || 0).toFixed(3)}\n` +
               `<b>🎯 Подтверждённых узлов:</b> ${stats.confirmedNodes || 0}\n\n` +
               `<i>🟢 Подтверждённые узлы | ⚫ Новые узлы | 🔴 Подтверждённые связи</i>`;
    }

    // Сохранение канваса в файл
    async saveCanvas(canvas, filePath) {
        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(filePath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
          
            out.on('finish', () => {
                console.log(`💾 Визуализация сохранена: ${filePath}`);
                resolve(filePath);
            });
          
            out.on('error', (error) => {
                console.log(`❌ Ошибка сохранения: ${error.message}`);
                reject(error);
            });
        });
    }

    // Очистка старых файлов
    cleanupOldFiles(maxAgeHours = 24) {
        const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        let deleted = 0;
      
        if (fs.existsSync(this.config.outputDir)) {
            const files = fs.readdirSync(this.config.outputDir);
          
            files.forEach(file => {
                const filePath = path.join(this.config.outputDir, file);
                const stats = fs.statSync(filePath);
              
                if (stats.mtimeMs < cutoffTime && file.endsWith('.png')) {
                    fs.unlinkSync(filePath);
                    deleted++;
                }
            });
          
            if (deleted > 0) {
                console.log(`🗑️ Удалено ${deleted} старых визуализаций`);
            }
        }
      
        return { success: true, deleted: deleted };
    }
}

module.exports = MergeVisualizer;
