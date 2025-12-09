// modules/footprint/graph-visualizer.js
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

class GraphVisualizer {
    constructor(options = {}) {
        this.canvasWidth = options.width || 800;
        this.canvasHeight = options.height || 600;
        this.outputDir = options.outputDir || './temp/visualizations';
        this.ensureOutputDir();
    }
    
    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    
    // 1. ВИЗУАЛИЗАЦИЯ ОДНОГО ГРАФА
    async visualizeGraph(graph, options = {}) {
        const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
        const ctx = canvas.getContext('2d');
        
        // Очистка фона
        ctx.fillStyle = options.backgroundColor || '#1a1a2e';
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // Найти границы графа
        const bounds = this.calculateBounds(graph);
        const scale = this.calculateScale(bounds, 100);
        const offset = this.calculateOffset(bounds, scale);
        
        // Отрисовка графа
        this.drawGraph(ctx, graph, scale, offset, {
            nodeColor: options.nodeColor || '#ff4757',
            edgeColor: options.edgeColor || '#70a1ff80',
            nodeRadius: options.nodeRadius || 4,
            showLabels: options.showLabels !== false
        });
        
        // Добавить информацию о графе
        this.drawGraphInfo(ctx, graph, options.title);
        
        // Сохранение
        const filename = options.filename || `graph_${Date.now()}.png`;
        const outputPath = path.join(this.outputDir, filename);
        await this.saveCanvas(canvas, outputPath);
        
        return outputPath;
    }
    
    // 2. ВИЗУАЛИЗАЦИЯ СРАВНЕНИЯ ДВУХ ГРАФОВ
    async visualizeComparison(graph1, graph2, comparisonResult = null, options = {}) {
        const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
        const ctx = canvas.getContext('2d');
        
        // Очистка фона
        ctx.fillStyle = '#0c2461';
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // Найти границы обоих графов
        const bounds = this.calculateCombinedBounds([graph1, graph2]);
        const scale = this.calculateScale(bounds, 100);
        const offset = this.calculateOffset(bounds, scale);
        
        // Отрисовка графа 1 (красный)
        this.drawGraph(ctx, graph1, scale, offset, {
            nodeColor: '#ff4757',
            edgeColor: '#ff6b8150',
            nodeRadius: 5,
            showLabels: false
        });
        
        // Отрисовка графа 2 (зеленый)
        this.drawGraph(ctx, graph2, scale, offset, {
            nodeColor: '#2ed573',
            edgeColor: '#7bed9f50',
            nodeRadius: 5,
            showLabels: false
        });
        
        // Если есть результаты сравнения - показать совпадения
        if (comparisonResult && comparisonResult.matchedNodes) {
            this.drawMatchedNodes(ctx, graph1, graph2, comparisonResult.matchedNodes, scale, offset);
        }
        
        // Информационная панель
        this.drawComparisonInfo(ctx, graph1, graph2, comparisonResult);
        
        // Сохранение
        const filename = options.filename || `comparison_${Date.now()}.png`;
        const outputPath = path.join(this.outputDir, filename);
        await this.saveCanvas(canvas, outputPath);
        
        return outputPath;
    }
    
    // 3. ВИЗУАЛИЗАЦИЯ МОДЕЛИ С КОНТУРОМ (лучший снимок)
    async visualizeModelWithContour(footprint, contourImagePath = null, options = {}) {
        const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
        const ctx = canvas.getContext('2d');
        
        // Тёмный фон
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // Если есть контурное фото - загружаем как подложку
        if (contourImagePath && fs.existsSync(contourImagePath)) {
            try {
                const image = await loadImage(contourImagePath);
                
                // Вычисляем размеры для отрисовки с сохранением пропорций
                const imgRatio = image.width / image.height;
                const canvasRatio = this.canvasWidth / this.canvasHeight;
                
                let drawWidth, drawHeight, drawX, drawY;
                
                if (imgRatio > canvasRatio) {
                    drawWidth = this.canvasWidth * 0.9;
                    drawHeight = drawWidth / imgRatio;
                    drawX = this.canvasWidth * 0.05;
                    drawY = (this.canvasHeight - drawHeight) / 2;
                } else {
                    drawHeight = this.canvasHeight * 0.9;
                    drawWidth = drawHeight * imgRatio;
                    drawX = (this.canvasWidth - drawWidth) / 2;
                    drawY = this.canvasHeight * 0.05;
                }
                
                // Полупрозрачная подложка
                ctx.globalAlpha = 0.25;
                ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
                ctx.globalAlpha = 1.0;
                
            } catch (error) {
                console.log('⚠️ Не удалось загрузить контурное изображение:', error.message);
            }
        }
        
        // Отрисовка графа модели
        const bounds = this.calculateBounds(footprint.graph);
        const scale = this.calculateScale(bounds, 150);
        const offset = this.calculateOffset(bounds, scale);
        
        // Отрисовка графа (белые точки на тёмном фоне)
        this.drawGraph(ctx, footprint.graph, scale, offset, {
            nodeColor: '#ffffff',
            edgeColor: '#70a1ff',
            nodeRadius: 4,
            showLabels: false
        });
        
        // Отрисовка статистики модели
        this.drawModelStats(ctx, footprint);
        
        // Сохранение
        const filename = options.filename || `model_${footprint.id?.slice(0, 8) || 'unknown'}.png`;
        const outputPath = path.join(this.outputDir, filename);
        await this.saveCanvas(canvas, outputPath);
        
        return outputPath;
    }
    
    // 4. ВИЗУАЛИЗАЦИЯ ИСТОРИИ СЕССИИ
    async visualizeSessionHistory(session, options = {}) {
        if (!session.currentFootprint || !session.analyses || session.analyses.length === 0) {
            return null;
        }
        
        const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
        const ctx = canvas.getContext('2d');
        
        // Тёмный фон
        ctx.fillStyle = '#0c2461';
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // Цвета для разных фото
        const colors = ['#ff9ff3', '#f368e0', '#ff6b6b', '#ff9f43', '#54a0ff', '#5f27cd'];
        
        // Масштаб и смещение для всех графов
        const allGraphs = [];
        
        // Собираем все графы из анализов
        session.analyses.forEach((analysis) => {
            if (analysis.success && analysis.graphSnapshot) {
                // Создаём упрощенный граф из снимка
                const tempGraph = this.createGraphFromSnapshot(analysis.graphSnapshot);
                allGraphs.push(tempGraph);
            }
        });
        
        // Добавляем финальный граф
        allGraphs.push(session.currentFootprint.graph);
        
        // Вычисляем общие границы
        const bounds = this.calculateCombinedBounds(allGraphs);
        const scale = this.calculateScale(bounds, 100);
        const offset = this.calculateOffset(bounds, scale);
        
        // Отрисовываем все графы разными цветами
        session.analyses.forEach((analysis, idx) => {
            if (analysis.success && analysis.graphSnapshot) {
                const tempGraph = this.createGraphFromSnapshot(analysis.graphSnapshot);
                
                this.drawGraph(ctx, tempGraph, scale, offset, {
                    nodeColor: colors[idx % colors.length],
                    edgeColor: colors[idx % colors.length] + '50',
                    nodeRadius: 2,
                    showLabels: false
                });
                
                // Номер фото
                ctx.fillStyle = colors[idx % colors.length];
                ctx.font = '12px Arial';
                ctx.fillText(`Ф${idx + 1}`, 20 + idx * 30, 40);
            }
        });
        
        // Отрисовка финальной модели (белым)
        this.drawGraph(ctx, session.currentFootprint.graph, scale, offset, {
            nodeColor: '#ffffff',
            edgeColor: '#ffffff',
            nodeRadius: 4,
            showLabels: false
        });
        
        // Информация о сессии
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.fillText(`Сессия: ${session.name || session.id.slice(0, 8)}`, 20, 20);
        ctx.font = '14px Arial';
        ctx.fillText(`Фото: ${session.photos?.length || 0}`, 20, 70);
        ctx.fillText(`Узлов: ${session.currentFootprint.graph.nodes.size}`, 20, 90);
        
        // Сохранение
        const filename = options.filename || `session_${session.id?.slice(0, 8) || 'unknown'}.png`;
        const outputPath = path.join(this.outputDir, filename);
        await this.saveCanvas(canvas, outputPath);
        
        return outputPath;
    }
    
    // 5. ВИЗУАЛИЗАЦИЯ АВТОСОВМЕЩЕНИЯ (процесс)
    async visualizeAlignmentProcess(steps, options = {}) {
        const frames = [];
        const stepsToShow = steps.slice(0, Math.min(steps.length, 10)); // Не более 10 кадров
        
        for (let i = 0; i < stepsToShow.length; i++) {
            const step = stepsToShow[i];
            const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
            const ctx = canvas.getContext('2d');
            
            // Фон
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
            
            // Масштаб и смещение
            const bounds = this.calculateCombinedBounds([step.before, step.after]);
            const scale = this.calculateScale(bounds, 150);
            const offset = this.calculateOffset(bounds, scale);
            
            // Граф "до" (красный)
            this.drawGraph(ctx, step.before, scale, offset, {
                nodeColor: '#ff475780',
                edgeColor: '#ff6b8150',
                nodeRadius: 3,
                showLabels: false
            });
            
            // Граф "после" (зеленый)
            this.drawGraph(ctx, step.after, scale, offset, {
                nodeColor: '#2ed573',
                edgeColor: '#7bed9f',
                nodeRadius: 4,
                showLabels: false
            });
            
            // Информация о шаге
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px Arial';
            ctx.fillText(`Шаг ${i + 1}/${stepsToShow.length}`, 20, 30);
            ctx.fillText(`Similarity: ${(step.similarity * 100).toFixed(1)}%`, 20, 55);
            
            if (step.action) {
                ctx.fillText(`Действие: ${step.action}`, 20, 80);
            }
            
            // Сохраняем кадр
            const framePath = path.join(this.outputDir, `align_step_${i.toString().padStart(2, '0')}.png`);
            await this.saveCanvas(canvas, framePath);
            frames.push(framePath);
        }
        
        return frames;
    }

// 6. ВИЗУАЛИЗАЦИЯ МОДЕЛИ С ИСТОРИЕЙ СОВПАДЕНИЙ
async visualizeModelWithHistory(footprint, options = {}) {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const ctx = canvas.getContext('2d');
   
    // Тёмный фон
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
   
    // Собираем статистику по узлам
    const nodeStats = this.calculateNodeStatistics(footprint);
   
    // Находим границы
    const bounds = this.calculateBounds(footprint.graph);
    const scale = this.calculateScale(bounds, 150);
    const offset = this.calculateOffset(bounds, scale);
   
    // Отрисовываем граф с цветами по статистике
    this.drawGraphWithStats(ctx, footprint.graph, nodeStats, scale, offset, options);
   
    // Отрисовываем легенду статистики
    this.drawStatsLegend(ctx, nodeStats);
   
    // Отрисовываем информацию о модели
    this.drawModelStats(ctx, footprint);
   
    // Сохранение
    const filename = options.filename || `model_history_${footprint.id?.slice(0, 8) || 'unknown'}.png`;
    const outputPath = path.join(this.outputDir, filename);
    await this.saveCanvas(canvas, outputPath);
   
    return outputPath;
}

// Метод для расчета статистики узлов
calculateNodeStatistics(footprint) {
    const stats = {
        nodes: new Map(), // nodeId -> { count: X, photos: [] }
        totalPhotos: footprint.metadata?.totalPhotos || footprint.photoHistory?.length || 0,
        photoHistory: footprint.photoHistory || []
    };
   
    // Собираем историю из анализов
    if (footprint.analysisHistory && footprint.analysisHistory.length > 0) {
        footprint.analysisHistory.forEach((analysis, photoIndex) => {
            if (analysis.graphSnapshot && analysis.graphSnapshot.nodes) {
                // Здесь нужно сопоставить узлы между фото
                // Пока упростим - считаем что узлы в том же порядке
                analysis.graphSnapshot.nodes.forEach((node, nodeIndex) => {
                    const nodeId = `n${nodeIndex + 1}`;
                    if (!stats.nodes.has(nodeId)) {
                        stats.nodes.set(nodeId, {
                            count: 0,
                            photos: [],
                            x: node.x,
                            y: node.y
                        });
                    }
                   
                    const nodeStat = stats.nodes.get(nodeId);
                    nodeStat.count++;
                    nodeStat.photos.push(photoIndex + 1);
                });
            }
        });
    }
   
    return stats;
}

// Отрисовка графа со статистикой
drawGraphWithStats(ctx, graph, nodeStats, scale, offset, options = {}) {
    const nodes = Array.from(graph.nodes?.values() || []);
    const edges = Array.from(graph.edges?.values() || []);
   
    if (nodes.length === 0) return;
   
    // Отрисовка рёбер
    ctx.strokeStyle = options.edgeColor || '#70a1ff50';
    ctx.lineWidth = 1;
   
    edges.forEach(edge => {
        const fromNode = graph.nodes?.get(edge.from);
        const toNode = graph.nodes?.get(edge.to);
       
        if (fromNode && toNode) {
            const x1 = fromNode.x * scale + offset.x;
            const y1 = fromNode.y * scale + offset.y;
            const x2 = toNode.x * scale + offset.x;
            const y2 = toNode.y * scale + offset.y;
           
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    });
   
    // Отрисовка узлов с цветами по статистике
    nodes.forEach(node => {
        const x = node.x * scale + offset.x;
        const y = node.y * scale + offset.y;
        const nodeStat = nodeStats.nodes.get(node.id);
        const matchCount = nodeStat ? nodeStat.count : 1;
       
        // Цвет в зависимости от количества совпадений
        let color, radius;
       
        if (matchCount === 1) {
            color = '#ff4757'; // Красный - 1 фото
            radius = 3;
        } else if (matchCount === 2) {
            color = '#ff9f43'; // Оранжевый - 2 фото
            radius = 4;
        } else if (matchCount === 3) {
            color = '#feca57'; // Желтый - 3 фото
            radius = 5;
        } else if (matchCount >= 4 && matchCount <= 6) {
            color = '#2ed573'; // Зеленый - 4-6 фото
            radius = 6;
        } else {
            color = '#54a0ff'; // Синий - 7+ фото
            radius = 7;
        }
       
        // Отрисовка узла
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
       
        // Обводка
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
       
        // Цифра с количеством совпадений
        if (matchCount > 1) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(matchCount.toString(), x, y);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        }
    });
}

// Легенда статистики
drawStatsLegend(ctx, nodeStats) {
    const legendX = 20;
    let legendY = this.canvasHeight - 180;
   
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('📊 СТАТИСТИКА СОВПАДЕНИЙ:', legendX, legendY);
   
    legendY += 25;
    ctx.font = '12px Arial';
   
    const legendItems = [
        { color: '#ff4757', label: '1 фото', desc: 'Точка с 1 фото' },
        { color: '#ff9f43', label: '2 фото', desc: 'Совпала на 2 фото' },
        { color: '#feca57', label: '3 фото', desc: 'Совпала на 3 фото' },
        { color: '#2ed573', label: '4-6 фото', desc: 'Хорошее совпадение' },
        { color: '#54a0ff', label: '7+ фото', desc: 'Отличное совпадение' }
    ];
   
    legendItems.forEach((item, index) => {
        // Цветной круг
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(legendX + 10, legendY + index * 25 + 5, 6, 0, Math.PI * 2);
        ctx.fill();
       
        // Текст
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${item.label}: ${item.desc}`, legendX + 25, legendY + index * 25 + 10);
    });
   
    // Общая статистика
    legendY += legendItems.length * 25 + 15;
    ctx.fillStyle = '#70a1ff';
    ctx.font = 'bold 13px Arial';
   
    const totalNodes = nodeStats.nodes.size;
    const avgMatches = totalNodes > 0
        ? Array.from(nodeStats.nodes.values()).reduce((sum, stat) => sum + stat.count, 0) / totalNodes
        : 0;
   
    const strongMatches = Array.from(nodeStats.nodes.values()).filter(stat => stat.count >= 3).length;
   
    ctx.fillText(`Всего узлов: ${totalNodes}`, legendX, legendY);
    ctx.fillText(`Среднее совпадений: ${avgMatches.toFixed(1)}`, legendX, legendY + 20);
    ctx.fillText(`Надёжных узлов (≥3 фото): ${strongMatches}`, legendX, legendY + 40);
    ctx.fillText(`Всего фото в модели: ${nodeStats.totalPhotos}`, legendX, legendY + 60);
}
    
    // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============
    
    drawGraph(ctx, graph, scale, offset, options = {}) {
        const nodes = Array.from(graph.nodes?.values() || []);
        const edges = Array.from(graph.edges?.values() || []);
        
        if (nodes.length === 0) return;
        
        // Отрисовка рёбер
        ctx.strokeStyle = options.edgeColor || '#ffffff50';
        ctx.lineWidth = options.edgeWidth || 1;
        
        edges.forEach(edge => {
            const fromNode = graph.nodes?.get(edge.from);
            const toNode = graph.nodes?.get(edge.to);
            
            if (fromNode && toNode) {
                const x1 = fromNode.x * scale + offset.x;
                const y1 = fromNode.y * scale + offset.y;
                const x2 = toNode.x * scale + offset.x;
                const y2 = toNode.y * scale + offset.y;
                
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        });
        
        // Отрисовка узлов
        nodes.forEach(node => {
            const x = node.x * scale + offset.x;
            const y = node.y * scale + offset.y;
            
            // Внешний круг
            ctx.fillStyle = options.nodeColor || '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, options.nodeRadius || 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Внутренний круг (для лучшей видимости)
            if (options.nodeRadius > 3) {
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(x, y, Math.max(1, options.nodeRadius - 2), 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Подпись узла (если включено)
            if (options.showLabels && node.id) {
                ctx.fillStyle = options.nodeColor || '#ffffff';
                ctx.font = '10px Arial';
                ctx.fillText(node.id.replace('n', ''), x + 8, y - 8);
            }
        });
    }
    
    drawGraphInfo(ctx, graph, title = null) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        
        if (title) {
            ctx.fillText(title, 20, 30);
        }
        
        ctx.font = '14px Arial';
        const nodesCount = graph.nodes?.size || 0;
        const edgesCount = graph.edges?.size || 0;
        ctx.fillText(`Узлов: ${nodesCount}`, 20, 55);
        ctx.fillText(`Рёбер: ${edgesCount}`, 20, 75);
        
        if (graph.name) {
            ctx.fillText(graph.name, this.canvasWidth - 200, 30);
        }
    }
    
    drawComparisonInfo(ctx, graph1, graph2, comparisonResult) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '18px Arial';
        ctx.fillText('СРАВНЕНИЕ ГРАФОВ', 20, 30);
        
        ctx.font = '14px Arial';
        ctx.fillStyle = '#ff4757';
        ctx.fillText(`Граф 1: ${graph1.nodes?.size || 0} узлов`, 20, 60);
        ctx.fillStyle = '#2ed573';
        ctx.fillText(`Граф 2: ${graph2.nodes?.size || 0} узлов`, 20, 85);
        
        if (comparisonResult) {
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`Similarity: ${(comparisonResult.similarity * 100).toFixed(1)}%`, 20, 110);
            ctx.fillText(`Decision: ${comparisonResult.decision || 'unknown'}`, 20, 135);
        }
        
        // Легенда
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        ctx.arc(this.canvasWidth - 100, 50, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('Граф 1', this.canvasWidth - 80, 55);
        
        ctx.fillStyle = '#2ed573';
        ctx.beginPath();
        ctx.arc(this.canvasWidth - 100, 80, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('Граф 2', this.canvasWidth - 80, 85);
    }
    
    drawModelStats(ctx, footprint) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.fillText(`МОДЕЛЬ: ${footprint.name || 'Без названия'}`, 20, 30);
        
        ctx.font = '14px Arial';
        ctx.fillText(`ID: ${footprint.id?.slice(0, 12) || 'unknown'}`, 20, 55);
        ctx.fillText(`Узлов: ${footprint.graph?.nodes?.size || 0}`, 20, 80);
        ctx.fillText(`Рёбер: ${footprint.graph?.edges?.size || 0}`, 20, 105);
        
        const confidence = footprint.stats?.confidence || footprint.confidence || 0;
        ctx.fillText(`Уверенность: ${Math.round(confidence * 100)}%`, 20, 130);
        
        const photos = footprint.metadata?.totalPhotos || 0;
        ctx.fillText(`Фото: ${photos}`, 20, 155);
        
        const created = footprint.metadata?.created 
            ? new Date(footprint.metadata.created).toLocaleDateString('ru-RU')
            : 'неизвестно';
        ctx.fillText(`Создана: ${created}`, 20, 180);
    }
    
    drawMatchedNodes(ctx, graph1, graph2, matchedNodes, scale, offset) {
        if (!matchedNodes || matchedNodes.length === 0) return;
        
        ctx.strokeStyle = '#ffdd59';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        
        matchedNodes.forEach(pair => {
            const node1 = graph1.nodes?.get(pair.node1);
            const node2 = graph2.nodes?.get(pair.node2);
            
            if (node1 && node2) {
                const x1 = node1.x * scale + offset.x;
                const y1 = node1.y * scale + offset.y;
                const x2 = node2.x * scale + offset.x;
                const y2 = node2.y * scale + offset.y;
                
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        });
        
        ctx.setLineDash([]);
    }
    
    calculateBounds(graph) {
        const nodes = Array.from(graph.nodes?.values() || []);
        
        if (nodes.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }
        
        const xs = nodes.map(n => n.x);
        const ys = nodes.map(n => n.y);
        
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
        };
    }
    
    calculateCombinedBounds(graphs) {
        const allNodes = [];
        graphs.forEach(graph => {
            if (graph && graph.nodes) {
                allNodes.push(...Array.from(graph.nodes.values()));
            }
        });
        
        if (allNodes.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }
        
        const xs = allNodes.map(n => n.x);
        const ys = allNodes.map(n => n.y);
        
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
        };
    }
    
    calculateScale(bounds, margin = 50) {
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        
        if (width === 0 && height === 0) return 1.0;
        
        const availableWidth = this.canvasWidth - margin * 2;
        const availableHeight = this.canvasHeight - margin * 2;
        
        const scaleX = availableWidth / Math.max(width, 1);
        const scaleY = availableHeight / Math.max(height, 1);
        
        return Math.min(scaleX, scaleY, 5.0); // Ограничиваем максимальный масштаб
    }
    
    calculateOffset(bounds, scale) {
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        
        return {
            x: this.canvasWidth / 2 - centerX * scale,
            y: this.canvasHeight / 2 - centerY * scale
        };
    }
    
    createGraphFromSnapshot(snapshot) {
        // Создаём упрощенный граф из снимка
        return {
            nodes: new Map(snapshot.nodes?.map((n, i) => [`n${i}`, {
                x: n.x || Math.random() * 100,
                y: n.y || Math.random() * 100,
                id: `n${i}`
            }]) || []),
            edges: new Map(),
            name: snapshot.name || 'Snapshot'
        };
    }
    
    async saveCanvas(canvas, filePath) {
        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(filePath);
            const stream = canvas.createPNGStream();
            
            stream.pipe(out);
            out.on('finish', () => {
                if (process.env.DEBUG_MODE === 'true') {
                    console.log(`✅ Визуализация сохранена: ${filePath}`);
                }
                resolve(filePath);
            });
            out.on('error', reject);
        });
    }
    
    // Очистка старых файлов визуализации
    cleanupOldFiles(maxAgeHours = 24) {
        try {
            if (!fs.existsSync(this.outputDir)) return 0;
            
            const files = fs.readdirSync(this.outputDir);
            const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
            let deleted = 0;
            
            files.forEach(file => {
                const filePath = path.join(this.outputDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtimeMs < cutoffTime) {
                    fs.unlinkSync(filePath);
                    deleted++;
                }
            });
            
            if (deleted > 0 && process.env.DEBUG_MODE === 'true') {
                console.log(`🧹 Удалено ${deleted} старых визуализаций`);
            }
            
            return deleted;
        } catch (error) {
            console.log('⚠️ Ошибка очистки визуализаций:', error.message);
            return 0;
        }
    }
}

module.exports = GraphVisualizer;
