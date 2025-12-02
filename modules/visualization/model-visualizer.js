// modules/visualization/model-visualizer.js
// Визуализация аккумулятивных моделей следов

const { createCanvas } = require('canvas');

class ModelVisualizer {
  constructor() {
    console.log('🎨 ModelVisualizer инициализирован');
  }
 
  /**
   * Визуализация модели
   */
  async visualizeModel(modelData, options = {}) {
    try {
      const {
        width = 800,
        height = 600,
        showGrid = true,
        showLabels = true,
        outputPath = null
      } = options;
     
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
     
      // Фон
      this.drawBackground(ctx, width, height);
     
      // Сетка
      if (showGrid) {
        this.drawGrid(ctx, width, height);
      }
     
      // Центральные оси
      this.drawAxes(ctx, width, height);
     
      // Рисуем связи
      if (modelData.edges && modelData.edges.length > 0) {
        this.drawEdges(ctx, modelData.edges, modelData.nodes);
      }
     
      // Рисуем узлы
      if (modelData.nodes && modelData.nodes.length > 0) {
        this.drawNodes(ctx, modelData.nodes, showLabels);
      }
     
      // Легенда и статистика
      this.drawLegend(ctx, width, height, modelData);
     
      // Сохранение или возврат буфера
      if (outputPath) {
        const fs = require('fs');
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);
        console.log(`✅ Визуализация сохранена: ${outputPath}`);
        return outputPath;
      } else {
        return canvas.toBuffer('image/png');
      }
     
    } catch (error) {
      console.log('❌ Ошибка визуализации модели:', error);
      return null;
    }
  }
 
  /**
   * Фон
   */
  drawBackground(ctx, width, height) {
    // Градиентный фон
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
   
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
 
  /**
   * Сетка
   */
  drawGrid(ctx, width, height) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
   
    // Вертикальные линии
    for (let x = 50; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
   
    // Горизонтальные линии
    for (let y = 50; y < height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
 
  /**
   * Центральные оси
   */
  drawAxes(ctx, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
   
    // Ось X
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
   
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
   
    // Ось Y
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();
   
    ctx.setLineDash([]);
   
    // Подписи осей
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px Arial';
    ctx.fillText('←', 10, centerY - 5);
    ctx.fillText('→', width - 15, centerY - 5);
    ctx.fillText('↑', centerX - 5, 15);
    ctx.fillText('↓', centerX - 5, height - 5);
  }
 
  /**
   * Рисование узлов
   */
  drawNodes(ctx, nodes, showLabels) {
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
   
    nodes.forEach(node => {
      const x = centerX + node.x;
      const y = centerY + node.y;
     
      // Цвет в зависимости от уверенности
      const color = this.getNodeColor(node.confidence);
      const radius = 5 + Math.min(node.occurrences * 2, 15);
     
      // Внешнее свечение для высокоуверенных узлов
      if (node.confidence > 0.7) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
      }
     
      // Внешний круг
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
     
      // Внутренний круг
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
     
      // Подпись
      if (showLabels && node.confidence > 0.5) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${(node.confidence * 100).toFixed(0)}%`, x, y - radius - 5);
       
        if (node.occurrences > 1) {
          ctx.font = '8px Arial';
          ctx.fillText(`×${node.occurrences}`, x, y + radius + 10);
        }
      }
    });
  }
 
  /**
   * Рисование связей
   */
  drawEdges(ctx, edges, nodes) {
    const nodeMap = new Map();
    nodes.forEach(node => nodeMap.set(node.id, node));
   
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
   
    edges.forEach(edge => {
      const node1 = nodeMap.get(edge.node1);
      const node2 = nodeMap.get(edge.node2);
     
      if (!node1 || !node2) return;
     
      const x1 = centerX + node1.x;
      const y1 = centerY + node1.y;
      const x2 = centerX + node2.x;
      const y2 = centerY + node2.y;
     
      // Прозрачность и толщина по уверенности связи
      const alpha = Math.min(edge.confidence, 0.6);
      ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
      ctx.lineWidth = 0.5 + edge.confidence * 1.5;
     
      // Пунктир для слабых связей
      if (edge.confidence < 0.4) {
        ctx.setLineDash([3, 3]);
      }
     
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
     
      ctx.setLineDash([]);
    });
  }
 
  /**
   * Легенда и статистика
   */
  drawLegend(ctx, width, height, modelData) {
    const legendX = 20;
    const legendY = 20;
   
    // Фон легенды
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(legendX - 10, legendY - 10, 260, 180);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX - 10, legendY - 10, 260, 180);
   
    // Заголовок
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('🕸️ АККУМУЛЯТИВНАЯ МОДЕЛЬ СЛЕДА', legendX, legendY + 10);
   
    // Статистика
    ctx.font = '12px Arial';
    ctx.fillText(`📊 Узлов: ${modelData.nodeCount || modelData.nodes?.length || 0}`, legendX, legendY + 35);
    ctx.fillText(`🔗 Связей: ${modelData.edgeCount || modelData.edges?.length || 0}`, legendX, legendY + 55);
    ctx.fillText(`📸 Фото: ${modelData.photosProcessed || 0}`, legendX, legendY + 75);
    ctx.fillText(`🎯 Уверенность: ${((modelData.confidence || 0) * 100).toFixed(1)}%`, legendX, legendY + 95);
   
    // Легенда цветов
    const colors = [
      { color: this.getNodeColor(0.9), label: 'Высокая (>80%)' },
      { color: this.getNodeColor(0.7), label: 'Средняя (60-80%)' },
      { color: this.getNodeColor(0.5), label: 'Низкая (<60%)' }
    ];
   
    colors.forEach((item, i) => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(legendX, legendY + 115 + i * 20, 5, 0, Math.PI * 2);
      ctx.fill();
     
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.fillText(item.label, legendX + 15, legendY + 120 + i * 20);
    });
   
    // Timestamp
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '9px Arial';
    const timestamp = modelData.timestamp ?
      new Date(modelData.timestamp).toLocaleString('ru-RU') :
      new Date().toLocaleString('ru-RU');
    ctx.fillText(`Сгенерировано: ${timestamp}`, legendX, legendY + 165);
  }
 
  /**
   * Цвет узла по уверенности
   */
  getNodeColor(confidence) {
    if (confidence > 0.8) return '#00ff00'; // зелёный
    if (confidence > 0.65) return '#ffff00'; // жёлтый
    if (confidence > 0.5) return '#ff9900'; // оранжевый
    return '#ff0000'; // красный
  }
 
  /**
   * Простая текстовая визуализация для Telegram
   */
  generateTextVisualization(modelData) {
    const stats = {
      nodes: modelData.nodes?.length || 0,
      edges: modelData.edges?.length || 0,
      confidence: modelData.confidence || 0,
      photos: modelData.photosProcessed || 0
    };
   
    let text = `🕸️ *ВИЗУАЛИЗАЦИЯ МОДЕЛИ*\n\n`;
    text += `📊 *Статистика:*\n`;
    text += `• Узлов: ${stats.nodes}\n`;
    text += `• Связей: ${stats.edges}\n`;
    text += `• Уверенность: ${(stats.confidence * 100).toFixed(1)}%\n`;
    text += `• Фото в модели: ${stats.photos}\n\n`;
   
    // Простая ASCII визуализация
    if (stats.nodes > 0) {
      text += `🎯 *Ключевые узлы:*\n`;
     
      modelData.nodes
        .filter(node => node.confidence > 0.7)
        .slice(0, 5)
        .forEach((node, i) => {
          text += `${i+1}. Уверенность: ${(node.confidence * 100).toFixed(0)}%`;
          if (node.occurrences > 1) text += ` (×${node.occurrences})`;
          text += `\n`;
        });
    }
   
    return text;
  }
}

module.exports = { ModelVisualizer };
