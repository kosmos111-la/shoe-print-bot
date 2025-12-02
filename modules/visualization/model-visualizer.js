// modules/visualization/model-visualizer.js
const { createCanvas, loadImage } = require('canvas');

class ModelVisualizer {
  async visualizeModel(modelData, originalImagePath = null, outputPath = null) {
    try {
      const canvasWidth = 800;
      const canvasHeight = 600;
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');
     
      // Фон
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
     
      // Сетка
      this.drawGrid(ctx, canvasWidth, canvasHeight);
     
      // Рисуем узлы
      this.drawNodes(ctx, modelData.nodes);
     
      // Рисуем связи
      this.drawEdges(ctx, modelData.edges, modelData.nodes);
     
      // Легенда и статистика
      this.drawLegend(ctx, canvasWidth, canvasHeight, modelData);
     
      // Сохранение
      const fs = require('fs');
      const finalPath = outputPath || `model_${Date.now()}.png`;
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(finalPath, buffer);
     
      console.log(`✅ Визуализация модели сохранена: ${finalPath}`);
      return finalPath;
     
    } catch (error) {
      console.log('❌ Ошибка визуализации модели:', error);
      return null;
    }
  }
 
  drawGrid(ctx, width, height) {
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
   
    // Вертикальные линии
    for (let x = 0; x <= width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
   
    // Горизонтальные линии
    for (let y = 0; y <= height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
 
  drawNodes(ctx, nodes) {
    nodes.forEach(node => {
      const x = node.x + 400; // смещаем в центр
      const y = node.y + 300;
     
      // Цвет в зависимости от уверенности
      let color;
      if (node.confidence > 0.8) color = '#00ff00'; // зелёный
      else if (node.confidence > 0.6) color = '#ffff00'; // жёлтый
      else color = '#ff9900'; // оранжевый
     
      // Внешний круг (уверенность)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();
     
      // Внутренний круг (размер по occurrences)
      const innerRadius = 5 + node.occurrences * 2;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
      ctx.fill();
     
      // Подпись с confidence
      ctx.fillStyle = '#000000';
      ctx.font = '10px Arial';
      ctx.fillText(`${(node.confidence * 100).toFixed(0)}%`, x - 10, y - 20);
     
      // ID узла (первые 4 символа)
      ctx.fillStyle = '#666666';
      ctx.font = '8px Arial';
      ctx.fillText(node.id.substr(0, 4), x - 8, y + 25);
    });
  }
 
  drawEdges(ctx, edges, nodes) {
    const nodeMap = new Map();
    nodes.forEach(node => nodeMap.set(node.id, node));
   
    edges.forEach(edge => {
      const node1 = nodeMap.get(edge.node1);
      const node2 = nodeMap.get(edge.node2);
     
      if (!node1 || !node2) return;
     
      const x1 = node1.x + 400;
      const y1 = node1.y + 300;
      const x2 = node2.x + 400;
      const y2 = node2.y + 300;
     
      // Прозрачность по confidence связи
      const alpha = Math.min(edge.confidence, 0.7);
      ctx.strokeStyle = `rgba(100, 100, 255, ${alpha})`;
      ctx.lineWidth = 1 + edge.confidence * 2;
     
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
     
      // Подпись с расстоянием
      if (edge.distance) {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
       
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.font = '7px Arial';
        ctx.fillText(`${edge.distance.toFixed(0)}px`, midX, midY);
      }
    });
  }
 
  drawLegend(ctx, width, height, modelData) {
    const legendX = 20;
    const legendY = height - 150;
   
    // Фон легенды
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(legendX - 10, legendY - 10, 250, 140);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX - 10, legendY - 10, 250, 140);
   
    // Заголовок
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('🕸️ АККУМУЛЯТИВНАЯ МОДЕЛЬ СЛЕДА', legendX, legendY);
   
    // Статистика
    ctx.font = '12px Arial';
    ctx.fillText(`📊 Узлов: ${modelData.nodes.length}`, legendX, legendY + 25);
    ctx.fillText(`🔗 Связей: ${modelData.edges.length}`, legendX, legendY + 45);
    ctx.fillText(`📸 Фото обработано: ${modelData.photosProcessed || 0}`, legendX, legendY + 65);
   
    // Легенда цветов
    const colors = [
      { color: '#00ff00', label: 'Высокая уверенность (>80%)' },
      { color: '#ffff00', label: 'Средняя уверенность (60-80%)' },
      { color: '#ff9900', label: 'Низкая уверенность (<60%)' }
    ];
   
    colors.forEach((item, i) => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(legendX, legendY + 85 + i * 20, 5, 0, Math.PI * 2);
      ctx.fill();
     
      ctx.fillStyle = '#000000';
      ctx.font = '10px Arial';
      ctx.fillText(item.label, legendX + 15, legendY + 90 + i * 20);
    });
   
    // Timestamp
    ctx.fillStyle = '#666666';
    ctx.font = '9px Arial';
    const timestamp = modelData.timestamp ?
      new Date(modelData.timestamp).toLocaleString('ru-RU') :
      new Date().toLocaleString('ru-RU');
    ctx.fillText(`Сгенерировано: ${timestamp}`, legendX, legendY + 130);
  }
}

module.exports = { ModelVisualizer };
